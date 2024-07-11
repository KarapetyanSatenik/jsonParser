const cheerio = require('cheerio');

module.exports.removeTags = (html, tagsToRemove) => {
    const $ = cheerio.load(html, null, false);

    if (tagsToRemove.length) {
        tagsToRemove.forEach(tag => {
            $(tag).contents().unwrap();
        });

        return $.html();
    }
    return $.text()
};

module.exports.escapeInnerQuotes = (str) => {
    let $ = cheerio.load(str, null, false);
  
    $('p').each((index, element) => {
      $(element).html($(element).html().replace(/"/g, '\\"'));
    });
    return $.html()
  }

module.exports.parseList = (html) => {
    const $ = cheerio.load(html, null, false);
    const listItems = [];

    $('ul li').each((index, element) => {
        listItems.push($(element).text());
    });
    
    return listItems;
};