import { Command } from "commander";
import fetch, { Response as FetchResponse } from "node-fetch";
import fs from "fs/promises";
import path from "path";
import inquirer from "inquirer";
import ora from "ora";

const REPO_URL =
  "https://api.github.com/repos/Qwertic/cursorrules/contents/rules";

interface CliOptions {
  remoteUrl?: string;
  localDir: string;
}

const asciiArt = `
   _____                           _____       _           
  / ____|                         |  __ \\     | |          
 | |     _   _ _ __ ___  ___  _ __| |__) |   _| | ___  ___ 
 | |    | | | | '__/ __|/ _ \\| '__|  _  / | | | |/ _ \\/ __|
 | |____| |_| | |  \\__ \\ (_) | |  | | \\ \\ |_| | |  __/\\__ \\
  \\_____|\\__,_|_|  |___/\\___/|_|  |_|  \\_\\__,_|_|\\___||___/
                                                           
`;

export async function retryFetch(
  url: string,
  maxRetries = 3
): Promise<FetchResponse> {
  let attempts = 0;
  while (attempts < maxRetries) {
    try {
      const response = await fetch(url);

      if (response.status === 403) {
        const rateLimitRemaining = response.headers.get(
          "x-ratelimit-remaining"
        );
        if (rateLimitRemaining === "0") {
          throw new Error(
            "GitHub API rate limit exceeded. Please try again later."
          );
        }
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response;
    } catch (error) {
      attempts++;
      if (attempts === maxRetries) {
        throw new Error(
          `Failed to fetch ${url} after ${maxRetries} attempts: ${
            (error as Error).message
          }`
        );
      }
      // Wait for a short time before retrying
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  // This line should never be reached, but TypeScript needs it
  throw new Error("Unexpected error in retryFetch");
}

export async function fetchDirectoryList(): Promise<string[]> {
  const spinner = ora("Fetching directory list...").start();
  try {
    const response = await retryFetch(REPO_URL);
    const directories = (await response.json()) as { name: string }[];
    spinner.succeed("Successfully fetched directory list");
    return directories.map((dir) => dir.name);
  } catch (error) {
    spinner.fail(`Error fetching directory list: ${(error as Error).message}`);
    throw new Error(
      "There was a problem connecting to the GitHub API. Please check your internet connection and try again."
    );
  }
}

export async function fetchCursorRulesFile(dirName: string): Promise<string> {
  const spinner = ora(`Fetching .cursorrules file from ${dirName}...`).start();
  try {
    const dirUrl = `${REPO_URL}/${dirName}`;
    const response = await retryFetch(dirUrl);
    const dirContents = (await response.json()) as {
      name: string;
      type: string;
      download_url: string;
    }[];

    const cursorrules = dirContents.find(
      (item) => item.type === "file" && item.name === ".cursorrules"
    );
    if (!cursorrules) {
      spinner.fail(`No .cursorrules file found in ${dirName}`);
      throw new Error(`No .cursorrules file found in ${dirName}`);
    }
    spinner.succeed(`Found .cursorrules file in ${dirName}`);
    return fetchRemoteFile(cursorrules.download_url);
  } catch (error) {
    spinner.fail(
      `Error fetching .cursorrules file: ${(error as Error).message}`
    );
    throw new Error(
      "There was a problem fetching the .cursorrules file. Please try again later."
    );
  }
}

export async function fetchRemoteFile(url: string): Promise<string> {
  const spinner = ora("Fetching remote file...").start();
  try {
    const response = await retryFetch(url);
    const content = await response.text();
    spinner.succeed("Successfully fetched remote file");
    return content;
  } catch (error) {
    spinner.fail(`Error fetching remote file: ${(error as Error).message}`);
    throw new Error(
      "There was a problem downloading the file. Please check your internet connection and try again."
    );
  }
}

async function promptUserForDirectory(directories: string[]): Promise<string> {
  try {
    const { selectedDir } = await inquirer.prompt([
      {
        type: "list",
        name: "selectedDir",
        message: "Choose a directory:",
        choices: directories,
      },
    ]);
    return selectedDir;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("User force closed the prompt")
    ) {
      console.log("Operation cancelled by user.");
      process.exit(0);
    }
    throw error;
  }
}

async function saveLocalFile(content: string, dir: string): Promise<void> {
  const filePath = path.join(dir, ".cursorrules");
  try {
    await fs.access(dir, fs.constants.W_OK);
    await fs.writeFile(filePath, content, "utf-8");
    console.log(`File saved to ${filePath}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Directory does not exist: ${dir}`);
    } else if ((error as NodeJS.ErrnoException).code === "EACCES") {
      throw new Error(`Permission denied: Unable to write to ${dir}`);
    } else {
      throw error;
    }
  }
}

async function main(options: CliOptions): Promise<void> {
  console.log(asciiArt);
  try {
    let content: string;
    if (options.remoteUrl) {
      if (
        !options.remoteUrl.startsWith("http://") &&
        !options.remoteUrl.startsWith("https://")
      ) {
        throw new Error(
          "Invalid URL format. URL must start with http:// or https://"
        );
      }
      content = await fetchRemoteFile(options.remoteUrl);
    } else {
      const dirList = await fetchDirectoryList();
      if (dirList.length === 0) {
        throw new Error("No directories found in the repository.");
      }
      const selectedDir = await promptUserForDirectory(dirList);
      content = await fetchCursorRulesFile(selectedDir);
    }
    if (!content.trim()) {
      throw new Error("The .cursorrules file is empty.");
    }
    await saveLocalFile(content, options.localDir);
    console.log("Successfully created .cursorrules file");
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error:", error.message);
      if (error.message.includes("ENOSPC")) {
        console.error(
          "There is not enough space on the disk to save the file."
        );
      } else if (error.message.includes("EACCES")) {
        console.error(
          "Permission denied. Try running the command with sudo or as an administrator."
        );
      } else if (error.message.includes("rate limit exceeded")) {
        console.error(
          "GitHub API rate limit exceeded. Please try again later."
        );
      } else {
        console.error(
          "An unexpected error occurred. Please try again or contact support if the problem persists."
        );
      }
    } else {
      console.error("An unknown error occurred.");
    }
    process.exit(1); // Add this line to exit the process on error
  }
}

const program = new Command();

program
  .name("crrl")
  .description(`${asciiArt}\nCLI to fetch and save .cursorrules files`)
  .version("0.1.0")
  .option("-u, --url <url>", "Remote URL of the .cursorrules file")
  .option(
    "-d, --dir <directory>",
    "Local directory to save the file",
    process.cwd()
  )
  .action((options) => {
    main({
      remoteUrl: options.url,
      localDir: options.dir,
    });
  });

program.parse(process.argv);
