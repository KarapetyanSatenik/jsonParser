const fs = require("fs");
const he = require("he");
const path = require("path");
const azDirectoryPath = path.join(__dirname, "data/input/azfolders");

fs.readdir(azDirectoryPath, (err, folders) => {
  if (err) {
    return console.error("Unable to scan directory: " + err);
  }

  folders.forEach((folder) => {
    const folderPath = path.join(azDirectoryPath, folder);

    fs.readdir(folderPath, (err, files) => {
      if (err) {
        return console.error("Unable to scan directory: " + err);
      }

      const jsonFiles = files.filter((file) => path.extname(file) === ".json");

      jsonFiles.forEach((file) => {
        const filePath = path.join(folderPath, file);
        const outFilePath = path.join(
          inDirectoryPath,
          `${file.slice(0, -5)}_${folder}.json`
        );

        fs.readFile(filePath, (err, data) => {
          if (err) {
            return console.error("Unable to read file: " + err);
          }

          fs.writeFile(outFilePath, data, (err) => {
            if (err) {
              return console.error("Unable to write file: " + err);
            }

            console.log(`Copied ${file} to ${outFilePath}`);
          });
        });
      });
    });
  });
});

const inDirectoryPath = path.join(__dirname, "json");
