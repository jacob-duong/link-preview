const linkPreview = require("./main");

const link = 'https://www.twitch.tv/ninja';
const link2 = 'https://www.twitch.tv/tritonpoker';
const clip = 'https://clips.twitch.tv/SpinelessObliqueStapleHumbleLife';
const video = 'https://variety.com/video/office-reunion-john-krasinski/';
const video2 = 'https://www.youtube.com/watch?v=scXtKhsLAb0'
const video3 = 'https://www.twitch.tv/videos/289016871'
const twitchClientID = '23ry1r95c0vkwtwyjzts1ogwy3ilk2';
const local = 'http://localhost:8002/game/10';
linkPreview(local, 3000, twitchClientID)
    .then((response) => {
        console.log(response);
    })
