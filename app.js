const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

const BASE_URL = "https://retail.era.ca"
const VIEWPORT = {width: 1080, height: 1024};

main();

async function main(){
    let browser = null;

    try{
        browser = await puppeteer.launch();
        let page = await browser.newPage();
        
        let collections = await getCollections(page);
        console.log(collections);
    }
    catch(err){
        console.error('Error: main:', err);
    }
    finally{
        if (browser){
            await browser.close();
        }
    }
}

function getCollections(page){
    return new Promise(async (resolve, reject) => {
        try{
            await page.goto(BASE_URL);
            await page.setViewport(VIEWPORT);

            setTimeout(async () => {
                let html = await page.content();
                let $ = cheerio.load(html);
                let collections = []

                let nav = $('nav')[0]
                let anchors = $(nav).find('a')

                for (let anchor of anchors){
                    let href = $(anchor).attr('href');
                    collections.push(href);
                }

                resolve(collections);
            }, 1000);
        }
        catch(err){
            reject(new Error('getCollections:', err));
        }
    })
}