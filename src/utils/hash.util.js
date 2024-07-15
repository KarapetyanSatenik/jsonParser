const crypto = require("crypto");

module.exports.generateHash = (data) => {
  const salt = crypto.randomBytes(16).toString('hex');
  return crypto.createHash("sha256").update(`${data}+${salt}`).digest("hex");
};