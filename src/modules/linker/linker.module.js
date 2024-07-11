const fs = require("fs");
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const path = require('path');

async function writeArrayToCsv(dataArray, fileName) {
  const csvPath = path.join(__dirname, fileName);
  const headers = Object.keys(dataArray[0]).map(key => ({ id: key, title: key }));

  const csvWriter = createCsvWriter({
    path: csvPath,
    header: headers,
    recordDelimiter: ','
  });

  try {
    await csvWriter.writeRecords(dataArray);
    console.log(`CSV file has been created at ${csvPath}`);
  } catch (error) {
    console.error('Error writing to CSV file:', error);
  }
}

const extracter = (arr, target) => {
  return arr.reduce((res, item)=> {
    if (item.type=='call_topic') {
      res.push(item.text)
    }
    if (item.components?.length) {
      const v = extracter(item.components)
      if (v.length) {
        res = res.concat(v)
      }
    }
    return res
  }, [])
}

const inDirectoryPath = path.join(__dirname, "output");
const outDirectoryPath = path.join(__dirname, "output");

let internalTopics = []
let topics = []
fs.readdir(inDirectoryPath, (err, files) => {
  if (err) {
    console.error("Unable to scan directory: " + err);
    return;
  }

  const jsonFiles = files.filter((file) => path.extname(file) === ".json");

  jsonFiles.forEach((file) => {
    const filePath = path.join(inDirectoryPath, file);
    const outFilePath = path.join(outDirectoryPath, file);

    let jsonData;
    try {
      jsonData = JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (err) {
      console.error(`Failed to read or parse file ${filePath}: ${err}`);
      return; // Skip this file and continue with the next one
    }

    internalTopics = internalTopics.concat(extracter(jsonData.topic.components))
    if (extracter(jsonData.topic.components).length) {
      topics.push(jsonData.topic.title)
    }
    
    // try {
    //   fs.writeFileSync(outFilePath, JSON.stringify(finalJSON));
    // } catch (err) {
    //   console.error(`Failed to write final JSON to ${outFilePath}: ${err}`);
    //   // No need to return here, as we're at the end of the loop anyway
    // }
  });

  topicsSet = new Set(topics)
  internalTopicSet = new Set(internalTopics)
  const missed = [...internalTopicSet].filter(item => !topicsSet.has(item));
  console.log(missed)
});
