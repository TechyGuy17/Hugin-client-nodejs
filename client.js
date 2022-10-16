const KryptokronaUtils = require('kryptokrona-utils')
const cnUtil = new KryptokronaUtils.CryptoNote()
const nacl = require('tweetnacl')
const naclUtil = require('tweetnacl-util')
const prompt = require('prompt-sync')();
var cron = require('node-cron');
require('dotenv').config();

function toHex(str,hex) {
    try {
        hex = unescape(encodeURIComponent(str))
        .split('').map(function(v){
            return v.charCodeAt(0).toString(16)
        }).join('')
    } catch(e) {
        hex = str
    }
    
    return hex
}

function nonceFromTimestamp(tmstmp) {
    let nonce = hexToUint(String(tmstmp));
    
    while (nonce.length < nacl.box.nonceLength) {
        tmp_nonce = Array.from(nonce)
        tmp_nonce.push(0);
        nonce = Uint8Array.from(tmp_nonce)
    }
    
    return nonce;
}

function hexToUint(hexString) {
    return new Uint8Array(hexString.match(/.{1,2}/g).map(byte => parseInt(byte, 16)))
}

async function sendGroupsMessage(message, nickname, group) {    
    const my_address = process.env.ADDRESS
    const private_key = process.env.PRIVKEY
    const signature = await cnUtil.signMessage(message, private_key)
    const timestamp = parseInt(Date.now())
    const nonce = nonceFromTimestamp(timestamp)
    
    
    let message_json = {
        "m": message,
        "k": my_address,
        "s": signature,
        "g": group,
        "n": nickname
    }
    
    const payload_unencrypted = naclUtil.decodeUTF8(JSON.stringify(message_json))
    const secretbox = nacl.secretbox(payload_unencrypted, nonce, hexToUint(group))
    const payload_encrypted = {"sb":Buffer.from(secretbox).toString('hex'), "t":timestamp}
    const payload_encrypted_hex = toHex(JSON.stringify(payload_encrypted))
    
    return await fetch(process.env.POSTSURL, {
    method: 'POST', // or 'PUT'
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({ payload: payload_encrypted_hex }),
}).then((response) => {
    return response.json()
}).then((json) => {
    // console.log(json)
    if(json.success == true) {
        console.log("The message was successfully sent!")
    } else {
        console.log("There was an error in sending the message!: " + json.error)
    }
})
}

async function getGroupPosts(possibleKey) {
    fetch(process.env.GETURL)
    .then((response) => {
        return response.json()
    })
    .then((json) => {
        // console.log(json.encrypted_group_posts)
        console.log("___________________ LOADING THE 3 LAST MESSAGES ___________________ ")
        json.encrypted_group_posts.forEach(encrypted_group_posts => {
            // console.log("sig: " + hexToUint(possibleKey))
            let decryptBox = false;
            let key;
            let groups = [possibleKey];
            let i = 0;
            while (!decryptBox && i < groups.length) {
                i += 1;
                try { 
                    decryptBox = nacl.secretbox.open(
                        hexToUint(encrypted_group_posts.tx_sb),
                        nonceFromTimestamp(encrypted_group_posts.tx_timestamp),
                        hexToUint(possibleKey)
                        );        
                        key = possibleKey;
                    } catch (err) {
                        console.log(err);
                        continue;
                    }
                }
                if (!decryptBox) {
                    return false;
                }
                const message_dec = naclUtil.encodeUTF8(decryptBox);
                const payload_json = JSON.parse(message_dec);
                const nickname = payload_json.n ? payload_json.n : t('Anonymous');
                // console.log(payload_json)
                console.log(nickname + ": " + payload_json.m)
                return
            })
        })
    }
    async function sendMessage() {
        username = prompt("Whats your username? ")
        group = prompt("What group do you want to send to? ")
        message = prompt("What message do you want to send? ")
        choice = prompt("Are you sure that you want to send '" + message + "' in the name of '" + username + "' to '" + group + "'? yes/no ")
        if(choice == "yes") {
            sendGroupsMessage(message, username, group)
            getGroupPosts(group)
        } else {
            return
        }
    }
    
    async function main() {
        console.log("Welcome to the Node.js Hugin Client")
        sendMessage()
        cron.schedule('*/1 * * * *', () => {
            getGroupPosts(group)
        });
        
    }
    main()
    
    
    
    