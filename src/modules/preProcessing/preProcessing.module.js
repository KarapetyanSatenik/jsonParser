const fs = require('fs');
const path = require('path');
const he = require('he');

const { removeTags, parseList, escapeInnerQuotes } = require('../../utils/htmlFormatter.util.js');
const { generateHash } = require('../../utils/hash.util.js');

const getRawStructure = (jsonData) => {
  const raw = he.decode(
    removeTags(jsonData.section[1].text.div, ['div'])
      .replace(/\n/g, ''))
  return JSON.parse(raw);
};

const jsonSearchByTitle = (json, titleValue) => {
  const traverse = (node) => {
    if (Array.isArray(node)) {
      return node.reduce((acc, current) => acc.concat(traverse(current)), []);
    } else if (node && typeof node === "object") {
      return Object.keys(node).reduce((acc, key) => {
        if (key === "title" && node[key] === titleValue) {
          acc.push(node.components);
        }
        return acc.concat(traverse(node[key]));
      }, []);
    }
    return [];
  };

  return traverse(json).flat().reduce((res, item) => {
    res.concat(parseList(item.html))
    return res
  }, [])

};

const convertToHierarchy = (
  { components, subsections },
  title,
  imageGenerator
) => {
  const messageComponent = (text) => ({ type: "message", text: text });
  const linkComponent = (text) => ({ type: "link", text: text });
  const conditionComponent = (subsection, components, level) => ({
    type: "condition",
    text: subsection.title,
    components:
      components.length > 0
        ? components
        : generateComponents(subsection.components, level+1),
  });
  const topicCallComponent = (text) => ({ type: "call_topic", text: text });

  const imageComponent = (figureCaption, fileId) => ({
    type: "image",
    caption: figureCaption,
    display: imageGenerator(fileId),
  });

  const subsectionsTitles = subsections.map((item) => item.title);

  const isTopicCall = (str) =>
    /^(US - [A-Za-z]+ - )?[A-Z0-9]+_[A-Za-z]+(_[A-Za-z]+)*$/.test(removeTags(str, ['p', 'span']));

  const mdLinkPattern = /\[([^\]]+)\]\(([^)]+)\)/;

  const generateComponents = (components, level) => {
    return components
      .reduce((acc, item) => {
        if (!item) return acc; // Skip if the item is null
        const { componentType, html, figureCaption, fileId } = item;
        const component = componentType === "Image" ?
          imageComponent(figureCaption, fileId) :
          subsectionsTitles.includes(html)
            ? linkComponent(html)
            : isTopicCall(html)
              ? topicCallComponent(removeTags(html, ['p', 'span']))
              : messageComponent(html)
        component.id = `${component.type}.${level}.${generateHash((component.title || component.text || component.display))}`
        acc = [
          ...acc,
          component
        ];
        return acc;
      }, [])
      //.filter((item) => !(item.type === "message" && !item.text)) // Skip if the item is a message without text
      .reduce((acc, current, index, array) => {
        const isStartOfQuestion =
          current.type === "message" &&
          index < array.length - 1 &&
          array[index + 1].type === "link";
        const isLinkOfQuestion =
          current.type === "link" && acc[acc.length - 1].type === "question";

        if (isStartOfQuestion) {
          acc.push({ id: `${current.type}.${level}.${generateHash((current.title || current.text))}`, type: "question", text: current.text, options: [] });
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
      components: generateComponents(block.components, 0),
    };
  });

  const cleanedJSON = Array.from(
    new Map(flatJSON.map((item) => [item.title, item])).values()
  );
  const Root = cleanedJSON.shift();

  const linkComponents = (component, blocks, level=0) => {
    const linkedComponents = component.components.reduce((acc, item) => {
      acc.push(item);

      if (item.type !== "question") {
        return acc;
      }

      for (const option of item.options) {
        const block = blocks.find((i) => i.title === option.text);
        if (block && !block.added) {
          block.added = true;
          block.id = generateHash(block.title);
          acc.push(linkComponents(block, blocks, level+1));
        } else {
          acc.push(
            conditionComponent(block, [
              {
                type: "go_to",
                text: block.title,
                refferenceId: blocks.find((i) => i.title === block.title).components[0].id,
              }, 
            ], level+1)
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
  return linkComponents(Root, cleanedJSON);
};

const inDirectoryPath = path.join(__dirname, "../../../data/output/json");
const outDirectoryPath = path.join(__dirname, "../../../data/output/output");

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
      process.exit(1)
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
      console.error(`Failed to generate final JSON for ${filePath}: ${err.stack}`);
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
    const imagePath = path.join(__dirname, "../../../data/output/static/images", filename);

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
