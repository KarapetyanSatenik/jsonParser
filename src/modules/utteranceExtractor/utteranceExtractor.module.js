const fs = require("fs");
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const path = require('path');

async function writeArrayToCsv(dataArray, fileName) {
  const csvPath = path.join(__dirname, fileName);
  const headers = Object.keys(dataArray[0]).map(key => ({ id: key, title: key }));

  const csvWriter = createCsvWriter({
    path: csvPath,
    header: headers
  });

  try {
    await csvWriter.writeRecords(dataArray);
    console.log(`CSV file has been created at ${csvPath}`);
  } catch (error) {
    console.error('Error writing to CSV file:', error);
  }
}

const inDirectoryPath = path.join(__dirname, "../../../data/output/output");
console.log(inDirectoryPath)

let dicTop = []

fs.readdir(inDirectoryPath, (err, files) => {
  if (err) {
    console.error("Unable to scan directory: " + err);
    return;
  }

  const jsonFiles = files.filter((file) => path.extname(file) === ".json");

  jsonFiles.forEach((file) => {
    const filePath = path.join(inDirectoryPath, file);

    let jsonData;
    try {
      jsonData = JSON.parse(fs.readFileSync(filePath, "utf8"));
      console.log(jsonData)
    } catch (err) {
      console.error(`Failed to read or parse file ${filePath}: ${err}`);
      return; // Skip this file and continue with the next one
    }
    dicTop = dicTop.concat(jsonData.phrases.map(el => ({title: jsonData.topic.title, phrase: el})))
    
    // try {
    //   fs.writeFileSync(outFilePath, JSON.stringify(finalJSON));
    // } catch (err) {
    //   console.error(`Failed to write final JSON to ${outFilePath}: ${err}`);
    //   // No need to return here, as we're at the end of the loop anyway
    // }
  });
  console.log(dicTop)
  writeArrayToCsv(dicTop, 'utterances.csv');
});
