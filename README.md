# crrl - Cursor Rules CLI



![crrl](https://github.com/user-attachments/assets/cf3cbba6-ccd3-4e9c-bdcc-58d34675075d)

`crrl` is a command-line interface (CLI) tool designed to fetch and save `.cursorrules` files from a GitHub repository or a remote URL. It simplifies the process of managing cursor rules for your projects.


## Features

- Fetch `.cursorrules` files from a specific [GitHub repository](https://github.com/Qwertic/cursorrules) that seerves as a remote storage for cursor rules
- Download `.cursorrules` files from a remote URL
- Interactive directory selection when fetching from the GitHub repository
- Save `.cursorrules` files to a specified local directory

## Installation

To install `crrl`, you need Node.js(^20) and npm (or pnpm) installed on your system. Then, you can install it globally using:

```bash
npm install -g crrl
```

## Usage

To use `crrl`, run the following command:

```bash
crrl
```

You can also use it to download a cursor rule by specifying the remote url:

```bash
crrl -u <remote-url> -d <local-directory>
```

## License

This project is licensed under the MIT License. See the [LICENSE](/LICENSE.md) file for more details.
