const cheerio = require("cheerio");
const request = require("request");
const api = require('twitch-api-v5');

const MATCH_VIDEO_URL = /(?:www\.|go\.)?twitch\.tv\/videos\/(\d+)($|\?)/
const MATCH_CHANNEL_URL = /(?:www\.|go\.)?twitch\.tv\/([a-z0-9_]+)($|\?)/

function isTwitch(url) {
    return MATCH_VIDEO_URL.test(url) || MATCH_CHANNEL_URL.test(url)
};

function collectTwitchMeta(meta, twitchClientID) {
    return new Promise((resolve, reject) => {
        if (isTwitch(meta.url) && twitchClientID) {
            const isChannel = MATCH_CHANNEL_URL.test(meta.url);
            const id = isChannel ? meta.url.match(MATCH_CHANNEL_URL)[1] : meta.url.match(MATCH_VIDEO_URL)[1];

            meta.ogVideoUrl = `https://player.twitch.tv/?allowfullscreen&autoplay&${isChannel ? 'channel' : 'video'}=${id}`;
            api.clientID = twitchClientID;

            isChannel ?
                api.users.usersByName({users: id}, (err, res) => {
                    if (!err && res.users && res.users.length) {
                        const user = res.users[0];
                        meta.title = user.display_name;
                        meta.description = user.bio || meta.title;
                        meta.image = user.logo;
                    }
                    resolve(meta);
                })
                :
                api.videos.getVideo({videoID: id}, (err, res) => {
                    if (!err) {
                        meta.title = res.title;
                        meta.description = res.title || meta.title;
                        meta.image = res.preview.large;
                    }
                    resolve(meta);
                });


        } else {
            resolve(meta);
        }
    });
};

const getByProp = ($, property) =>
    $(`meta[property='${property}']`)
        .first()
        .attr("content") || null;

const getByTag = ($, property) =>
    $('title')
        .first()
        .html() || null;

function collectMeta($, url, twitchClientID) {
    const ogUrl = getByProp($, "og:url");
    const ogVideoUrl = getByProp($, "og:video:secure_url") || getByProp($, "og:video:url") || "";

    const res = {
        url,
        image: getByProp($, "og:image"),
        imageWidth: getByProp($, "og:image:width"),
        imageHeight: getByProp($, "og:image:height"),
        imageType: getByProp($, "og:image:type"),
        title: getByProp($, "og:title") || getByTag($, 'title'),
        description: getByProp($, "og:description") || getByProp($, "description") || getByProp($, "Description"),
        siteName: getByProp($, "og:site_name"),
        ogVideoUrl: (ogVideoUrl || "").indexOf("youtube.com") >= 0 ? null : ogVideoUrl,
        ogUrl,
        youtube:
            (ogVideoUrl || "").indexOf("youtube.com") >= 0
                ? ogVideoUrl
                : !ogUrl ? null : ogUrl.indexOf("youtube.com") >= 0 ? `https://youtube.com/embed/${getValue(ogUrl, "v")}` : null
    };

    if (twitchClientID && !res.ogVideoUrl && !res.youtube) {
        return collectTwitchMeta(res, twitchClientID);
    }
    return Promise.resolve(res);
}

const getValue = (url, name) => {
    const i = url.indexOf(`${name}=`) + name.length + 1;
    const j = url.indexOf("&", i);
    const end = j < 0 ? url.length : j;
    return i < 0 ? "" : url.slice(i, end);
};

const getError = url => ({
    url,
    image: null,
    imageWidth: null,
    imageHeight: null,
    imageType: null,
    title: undefined,
    description: null,
    siteName: null
});

function linkPreview(url, timeout = 100000, twitchClientID = null) {
    if (!url || url === "") return Promise.reject({message: "You must add a valid url"});
    if (!url.match(/^http(s)?:\/\/[a-z]+\.[a-z]+(.)+/i)) return Promise.resolve(getError(url));
    return linkPreview.makeRequest(url, timeout).then(({response, body}) => {
        if (!response) return getError(url);
        if (response.statusCode === 200) return collectMeta(cheerio.load(body), url, twitchClientID);
        return getError(url);
    });
}

linkPreview.makeRequest = (url, timeout) =>
    new Promise((resolve, reject) => {
        request(url, {timeout: timeout}, (error, response, body) => resolve({body, response}));
    });

module.exports = linkPreview;
