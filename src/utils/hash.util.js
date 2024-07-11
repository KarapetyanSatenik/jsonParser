const crypto = require("crypto");

module.exports.generateHash = (data) => {
  return crypto.createHash("sha256").update(data).digest("hex");
};