const solanaWeb3 = require('@solana/web3.js');
const { Connection, programs } = require('@metaplex/js');
const axios = require('axios');

require('dotenv').config();

const projectURL = process.env.PROJECT_ADDRESS;
const discordURL = process.env.DISCORD_URL;

if (!projectURL || !discordURL) {
    console.log("please set your environment variables!");
    return;
}


// const projectPubKey = new solanaWeb3.PublicKey(process.env.PROJECT_ADDRESS);
const projectPubKey = new solanaWeb3.PublicKey(projectURL);
const url = solanaWeb3.clusterApiUrl('mainnet-beta');
const solanaConnection = new solanaWeb3.Connection(url, 'confirmed');
const metaplexConnection = new Connection('mainnet-beta');
const { metadata: { Metadata } } = programs;
const pollingInterval = 2000; // ms
const marketplaceMap = {
    "MEisE1HzehtrDpAAT8PnLHjpSSkRYakotTuJRPjTpo8": "Magic Eden",
    "M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K": "MagicEden V2",
    "HZaWndaNWHFDd9Dhk5pqUUtsmoBCqzb1MLu3NAh1VX6B": "Alpha Art",
    "617jbWo616ggkDxvW1Le8pV38XLbVSyWY8ae6QUmGBAU": "Solsea",
    "CJsLwbP1iu5DuUikHEJnLfANgKy6stB2uFgvBBHoyxwz": "Solanart",
    "A7p8451ktDCHq5yYaHczeLMYsjRsAkzc3hCXcSrwYHU7": "Digital Eyes",
    "AmK5g2XcyptVLCFESBCJqoSfwV3znGoVYQnqEnaAZKWn": "Exchange Art",
};

const runSalesBot = async () => {
    console.log("starting sales bot...");

    let signatures;
    let lastKnownSignature;
    const options = {};
    while (true) {
        try {
            signatures = await solanaConnection.getSignaturesForAddress(projectPubKey, options);
            if (!signatures.length) {
                console.log("polling...")
                await timer(pollingInterval);
                continue;
            }
        } catch (err) {
            console.log("error fetching signatures: ", err);
            continue;
        }

        for (let i = signatures.length - 1; i >= 0; i--) {
            try {
                let { signature } = signatures[i];
                const txn = await solanaConnection.getTransaction(signature);
                if (txn.meta && txn.meta.err != null) { continue; }

                const dateString = new Date(txn.blockTime * 1000).toLocaleString();
                const price = Math.abs((txn.meta.preBalances[0] - txn.meta.postBalances[0])) / solanaWeb3.LAMPORTS_PER_SOL;
                const accounts = txn.transaction.message.accountKeys;
                const marketplaceAccount = accounts[accounts.length - 1].toString();

                if (marketplaceMap[marketplaceAccount]) {
                    const metadata = await getMetadata(txn.meta.postTokenBalances[0].mint);
                    if (!metadata) {
                        console.log("couldn't get metadata");
                        continue;
                    }

                    printSalesInfo(dateString, price, signature, metadata.name, marketplaceMap[marketplaceAccount], metadata.image);
                    await postSaleToDiscord(metadata.name, price, dateString, signature, metadata.image)
                } else {
                    console.log("not a supported marketplace sale");
                }
            } catch (err) {
                console.log("error while going through signatures: ", err);
                continue;
            }
        }

        lastKnownSignature = signatures[0].signature;
        if (lastKnownSignature) {
            options.until = lastKnownSignature;
        }
    }
}
runSalesBot();

const printSalesInfo = (date, price, signature, title, marketplace, imageURL) => {
    console.log("-------------------------------------------")
    console.log(`Sale at ${date} ---> ${price} SOL`)
    console.log("Signature: ", signature)
    console.log("Name: ", title)
    console.log("Image: ", imageURL)
    console.log("Marketplace: ", marketplace)

    axios.post(discordURL,
        {
            "embeds": [
                {
                "title": `${title} has been sold! :moneybag:`,

                    //greencolor
                "color": 4321431, 

                    //yellowcolor
                // "color": 16172079,

                    //orangecolor
                // "color": 15695665,


                    //pinkcolor
                // "color": 16065893,


                    //bluecolor
                // "color": 39129,

                    //redcolor
                // "color": 15879747,

                "url": `https://explorer.solana.com/tx/${signature}`,
                "image": {
                    "url": `${imageURL}`
                },
                "footer": {
                    "text": "powered by Kawaii Animals Club",
                    "icon_url": "https://i.imgur.com/zkt2StD.png"
                },
                    "fields": [
                    {
                        "name": "ITEM",
                        "value": `${title}`,
                        "inline": false
                    },
                    {
                        "name": "Selling Price",
                        "value": `${price} Sol`,
                        "inline": true
                    },
                    {
                        "name": "Marketplace",
                        "value": `${marketplace}`,
                        "inline": true
                    },
                    {
                        "name": "Transaction",
                        "value": `https://explorer.solana.com/tx/${signature}`,
                        "inline": false
                    }
                    ]
                }
            ]
        }
    )
}

const timer = ms => new Promise(res => setTimeout(res, ms))

const getMetadata = async (tokenPubKey) => {
    try {
        const addr = await Metadata.getPDA(tokenPubKey)
        const resp = await Metadata.load(metaplexConnection, addr);
        const { data } = await axios.get(resp.data.data.uri);

        return data;
    } catch (error) {
        console.log("error fetching metadata: ", error)
    }
}

