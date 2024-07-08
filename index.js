const fs = require("fs");
const he = require("he");
const path = require("path");

const crypto = require("crypto");

const generateHash = (data) => {
  return crypto.createHash("sha256").update(data).digest("hex");
};

const getRawStructure = (jsonData) => {
  const regex = /<div[^>]*>(.*?)<\/div>/gs;

  const texts = [];
  let match;
  while (
    (match = regex.exec(he.decode(jsonData.section[1].text.div))) !== null
  ) {
    texts.push(match[1]);
  }

  return JSON.parse(texts[0].replace(/\n/g, "\\n"));
};

const jsonSearchByTitle = (json, titleValue) => {
  const result = [];

  function traverse(node) {
    if (node && typeof node === "object" && node.title === titleValue) {
      result.push(node);
    }

    if (node && typeof node === "object" && node.hasOwnProperty("title")) {
      for (const key in node) {
        if (node.hasOwnProperty(key)) {
          traverse(node[key]);
        }
      }
    }

    if (node && Array.isArray(node)) {
      node.forEach((element) => {
        traverse(element);
      });
    }
  }

  traverse(json);
  // throw an error
  // const phrases = result
  //   .map((i) => i.components.map((i) => i.html))
  //   .flat()[0]
  //   .split("\n")
  //   .map((i) => i.replace(/<\/?[^>]+(>|$)/g, ""))
  //   .filter((i) => !!i);

  const phrases = result
    .map((i) => i.components.map((i) => i.html))
    .flat()[0]
    .split("\n")
    .map((i) => i.replace(/<\/?[^>]+(>|$)/g, ""))
    .filter((i) => !!i);
  return phrases;
};

const convertToHierarchy = (
  { components, subsections },
  title,
  imageGenerator
) => {
  const messageComponent = (text) => ({ type: "message", text: text });
  const linkComponent = (text) => ({ type: "link", text: text });
  const conditionComponent = (subsection, components) => ({
    type: "condition",
    text: subsection.title,
    components:
      components.length > 0
        ? components
        : generateComponents(subsection.components),
  });
  const topicCallComponent = (text) => ({ type: "call_topic", text: text });

  const imageComponent = (figureCaption, fileId) => ({
    type: "image",
    caption: figureCaption,
    display: imageGenerator(fileId),
  });

  const subsectionsTitles = subsections.map((item) => item.title);

  const isTopicCall = (str) =>
    /[\w-]*_[\w-]*/.test(str?.replace(/<[^>]+>/g, ""));

  const mdLinkPattern = /\[([^\]]+)\]\(([^)]+)\)/;

  const generateComponents = (components) => {
    return components
      .reduce((acc, item) => {
        if (!item) return acc; // Skip if the item is null
        const { componentType, html, figureCaption, fileId } = item;
        acc = [
          ...acc,
          subsectionsTitles.includes(html)
            ? linkComponent(html)
            : isTopicCall(html)
            ? topicCallComponent(html)
            : componentType === "Image"
            ? imageComponent(figureCaption, fileId)
            : messageComponent(html),
        ];
        return acc;
      }, [])
      .filter((item) => !(item.type === "message" && !item.text)) // Skip if the item is a message without text
      .reduce((acc, current, index, array) => {
        const isStartOfQuestion =
          current.type === "message" &&
          index < array.length - 1 &&
          array[index + 1].type === "link";
        const isLinkOfQuestion =
          current.type === "link" && acc[acc.length - 1].type === "question";

        if (isStartOfQuestion) {
          acc.push({ type: "question", text: current.text, options: [] });
          return acc;
        }
        if (isLinkOfQuestion) {
          acc[acc.length - 1].options.push(current);
          return acc;
        }

        acc.push(current);
        return acc;
      }, []);
  };
  const flatJSON = [
    {
      type: "root",
      title: title,
      components: components,
    },
    ...subsections.map((i) => ({
      type: "condition",
      title: i.title,
      components: i.components,
    })),
  ].map((block) => {
    return {
      ...block,
      components: generateComponents(block.components),
    };
  });
  const cleanedJSON = Array.from(
    new Map(flatJSON.map((item) => [item.title, item])).values()
  );
  const Root = cleanedJSON.shift();

  const linkComponents = (component, blocks, level = 0, maxLevel = 3) => {
    if (level > maxLevel || !component) {
      // Skip if the component is null
      return;
    }

    const linkedComponents = component.components.reduce((acc, item) => {
      if (item.type !== "question") {
        acc.push(item);
        return acc;
      }
      acc.push(item);
      for (const option of item.options) {
        const block = blocks.find((i) => i.title === option.text);
        if (block && !block.added) {
          block.added = true;
          block.id = generateHash(block.title);
          acc.push(linkComponents(block, blocks));
        } else {
          acc.push(
            conditionComponent(block, [
              {
                type: "go_to",
                text: block.title,
                refferenceId: blocks.find((i) => i.title === block.title).id,
              },
            ])
          );
        }
      }
      return acc;
    }, []);

    return {
      ...component,
      components: linkedComponents,
    };
  };
  console.log(linkComponents(Root, cleanedJSON), null, 2);
  return linkComponents(Root, cleanedJSON);
};

const inDirectoryPath = path.join(__dirname, "json");
const outDirectoryPath = path.join(__dirname, "outputv3");

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
    let rawJSON;
    let imageGenerator;
    try {
      rawJSON = getRawStructure(jsonData);

      imageGenerator = imageGeneratorProducer(jsonData);
    } catch (err) {
      console.error(
        `Failed to get raw structure from data in ${filePath}: ${err}`
      );
      return; // Skip this file and continue with the next one
    }

    let finalJSON;
    try {
      finalJSON = {
        phrases: jsonSearchByTitle(rawJSON, "<p>Utterances</p>"),
        topic: convertToHierarchy(rawJSON, jsonData.title, imageGenerator),
      };
    } catch (err) {
      console.error(`Failed to generate final JSON for ${filePath}: ${err}`);
      return; // Skip this file and continue with the next one
    }

    try {
      fs.writeFileSync(outFilePath, JSON.stringify(finalJSON));
    } catch (err) {
      console.error(`Failed to write final JSON to ${outFilePath}: ${err}`);
      // No need to return here, as we're at the end of the loop anyway
    }
  });
});

const imageGeneratorProducer = (source) => (id) => {
  const img = source.relatesTo.find((i) =>
    i.targetReference.reference.includes(id)
  );

  if (img) {
    // Extract image data
    const imageData = img.targetReference.display;

    // Generate a unique filename
    const filename = img.targetReference.reference;

    // Define the path where the image will be saved
    const imagePath = path.join(__dirname, "images", filename);

    // Write the image data to a file
    fs.writeFile(imagePath, imageData, "base64", (err, data) => {
      if (err) {
        console.log(4444, err);
      }
    });

    // Return the URL of the image
    return `https://aznonprodaimichatbotdev.z20.web.core.windows.net/images/${filename}`;
  }
};
