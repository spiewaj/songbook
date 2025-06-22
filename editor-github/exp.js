const crypto = require('crypto');

// Generated using: crypto.randomBytes(16);.toString("hex");
const CRYPTO_IV =  Buffer.from("b99e5a7e5363c58b07a62d12264e4b18", "hex");
// Generated: console.log(crypto.randomBytes(24).toString("hex"));
const CRYPTO_KEY = Buffer.from("c5bcc1782e71bb5d522d7c36cd9eaa50cf91aefb5349d691", "hex");

function encrypt(txt) {
  let cipher = crypto.createCipheriv("aes192", CRYPTO_KEY, CRYPTO_IV);
  let encrypted = cipher.update(txt);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return encrypted;
}

function decrypt(txt) {
  let cipher = crypto.createDecipheriv("aes192", CRYPTO_KEY, CRYPTO_IV);
  let encrypted = cipher.update(txt);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return encrypted.toString();
}

function encryptJSON(json) {
  return encrypt(JSON.stringify(json));
}

function encryptJSONhex(json) {
  return encryptJSON(json).toString("hex");
}

function decryptJSON(jsonContent) {
  return JSON.parse(decrypt(jsonContent));
}


function decryptJSONhex(jsonContent) {
  return decryptJSON(Buffer.from(jsonContent, "hex"));
}


function test() {
  console.log(encryptJSONhex({"jeden": 1, "dwa": 2}));
  console.log(decryptJSONhex(
      "0d9b6aa042cf845fe679b91b13e5800dc859d229ec451a180e9e26874ee46531"));
}


console.log(`      abcd
    cztery`.replaceAll(/(?<=^ *)  /gm,"\t"));

console.log("Pieśń na pieśniami-to jest _dzieło_.xml".replaceAll(/[^a-zA-Z0-9\.\-_]/g, "_"));