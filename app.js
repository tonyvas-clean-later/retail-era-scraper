const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

const BASE_URL = "https://retail.era.ca"
const VIEWPORT = {width: 1080, height: 1024};

const COLLECTION_BLACKLIST = [ '/collections/all' ];

console.clear();
main();

async function main(){
    let browser = null;

    try{
        browser = await puppeteer.launch();
        let page = await browser.newPage();
        
        // let collections = await getCollections(page);
        // for (let collection of collections){
        //     let items = await getCollectionItems(page, collection);
        // }

        let test = [
            'https://retail.era.ca/collections/cooling',
            'https://retail.era.ca/collections/tablets',
            'https://retail.era.ca/collections/servers'
        ]

        for (let collection of test){
            let items = await getCollectionItems(page, collection);
            console.log(items);
        }
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
                    if (!COLLECTION_BLACKLIST.includes(href)){
                        collections.push(`${BASE_URL}${href}`);
                    }
                }

                resolve(collections);
            }, 1000);
        }
        catch(err){
            reject(new Error('getCollections:', err));
        }
    })
}

function getCollectionItems(page, collection){
    return new Promise(async (resolve, reject) => {
        try{
            let pages = await getCollectionPages(page, collection);

            resolve(pages)
        }
        catch(err){
            reject(new Error('getCollectionItems:', err));
        }
    })
}

function getCollectionPages(page, collection){
    return new Promise(async (resolve, reject) => {
        try{
            let pages = [];

            await page.goto(collection);
            await page.setViewport(VIEWPORT);

            let html = await page.content();
            let $ = cheerio.load(html);

            let navs = $('.pagination--inner');
            if (navs.length > 0){
                let nav = navs[0];
                let children = $(nav).children()
                for (let i = 0; i < children.length - 1; i++){
                    pages.push(`${collection}?page=${i + 1}`);
                }
            }
            else{
                pages.push(collection);
            }

            resolve(pages);
        }
        catch(err){
            reject(new Error('getCollectionPages:', err));
        }
    })
}