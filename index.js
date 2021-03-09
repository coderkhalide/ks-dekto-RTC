// create Agora client
var client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

var localTracks = {
  videoTrack: null,
  audioTrack: null
};

var localTrackState = {
  videoTrackEnabled: true,
  audioTrackEnabled: true
}

var remoteUsers = {};
// Agora client options
var options = {
  appid: "627d063f3a284c10a59a0c21328079d1",
  channel: null,
  uid: null,
  token: null
};

// the demo can auto join channel with params in url
$(() => {
  var urlParams = new URL(location.href).searchParams;
  options.appid = urlParams.get("appid");
  options.channel = urlParams.get("channel");
  options.token = urlParams.get("token");
  if (options.channel) {
    $("#channel").val(options.channel);
  }

})

$("#join-form").submit(async function (e) {
  e.preventDefault();
  $("#join").attr("disabled", true);
  $("#screen").attr("disabled", true);

  
  try {

    options.channel = $("#channel").val();

    const url = "https://ks-token.herokuapp.com/access_token?channelName=" + options.channel;

    let response = await fetch(url)
    response = await response.json()
    options.token = response.token

    await join();

    document.querySelector('#join-form').classList.add('d-none')
    document.querySelector('.copyLink').classList.add('active')

    const baseUrl = document.URL
    const link = baseUrl.slice(0, baseUrl.indexOf('?')) + '?channel=' + options.channel;

    document.querySelector('#myInput').value = link

    // if(options.token) {
    //   $("#success-alert-with-token").css("display", "block");
    // } else {
    //   $("#success-alert a").attr("href", `index.html?appid=${options.appid}&channel=${options.channel}&token=${options.token}`);
    //   $("#success-alert").css("display", "block");
    // }
  } catch (error) {
    console.error(error);
  } finally {
    $("#leave").attr("disabled", false);
    $("#screen").attr("disabled", false);
  }
});

$("#leave").click(function (e) {
  leave();
  document.querySelector('.app__form').classList.remove('de-active')
  document.querySelector('#join-form').classList.remove('d-none')
  document.querySelector('.copyLink').classList.remove('active')
});

$("#screen").click(function (e) {
  joinScreen();
});

$("#mute-audio").click(function (e) {
  if (localTrackState.audioTrackEnabled) {
    muteAudio();
  } else {
    unmuteAudio();
  }
});

$("#mute-video").click(function (e) {
  if (localTrackState.videoTrackEnabled) {
    muteVideo();
  } else {
    unmuteVideo();
  }
})

$("#muteVideo").click(function (e) {
  if (localTrackState.videoTrackEnabled) {
    muteVideo();
    setPlayVideo()
  } else {
    unmuteVideo();
    setStopVideo()
  }
})

$(".closeBtn").click(function (e) {
  document.querySelector('.app__form').classList.add('de-active')
})

async function join() {
  // add event listener to play remote tracks when remote users join, publish and leave.
  client.on("user-published", handleUserPublished);
  client.on("user-joined", handleUserJoined);
  client.on("user-left", handleUserLeft);

  // join a channel and create local tracks, we can use Promise.all to run them concurrently
  [ options.uid, localTracks.audioTrack, localTracks.videoTrack ] = await Promise.all([
    // join the channel
    client.join(options.appid, options.channel, options.token || null),
    // create local tracks, using microphone and camera
    AgoraRTC.createMicrophoneAudioTrack(),
    AgoraRTC.createCameraVideoTrack()
  ]);

  showMuteButton();
  
  // play local video track
  localTracks.videoTrack.play("local-player");
  // $("#local-player-name").text(`localVideo(${options.uid})`);

  // publish local tracks to channel
  await client.publish(Object.values(localTracks));
  console.log("publish success");
}

async function joinScreen() {
  for (trackName in localTracks) {
    var track = localTracks[trackName];
    if(track) {
      track.stop();
      track.close();
      localTracks[trackName] = undefined;
    }
  }

  // leave the channel
  await client.leave();


  // add event listener to play remote tracks when remote users join, publish and leave.
  client.on("user-published", handleUserPublished);
  client.on("user-joined", handleUserJoined);
  client.on("user-left", handleUserLeft);

  // join a channel and create local tracks, we can use Promise.all to run them concurrently
  [ options.uid, localTracks.audioTrack, localTracks.videoTrack ] = await Promise.all([
    // join the channel
    client.join(options.appid, options.channel, options.token || null),
    // create local tracks, using microphone and camera
    AgoraRTC.createMicrophoneAudioTrack(),
    AgoraRTC.createScreenVideoTrack()
  ]);

  showMuteButton();
  $("#leave").attr("disabled", false);

  // play local video track
  localTracks.videoTrack.play("local-player");
  // $("#local-player-name").text(`localVideo(${options.uid})`);

  // publish local tracks to channel
  await client.publish(Object.values(localTracks));
  console.log("publish success");
  updatePerticipates()
}

async function leave() {
  for (trackName in localTracks) {
    var track = localTracks[trackName];
    if(track) {
      track.stop();
      track.close();
      localTracks[trackName] = undefined;
    }
  }

  // remove remote users and player views
  remoteUsers = {};
  $("#remote-playerlist").html("");

  // leave the channel
  await client.leave();

  // $("#local-player-name").text("");
  $("#join").attr("disabled", false);
  $("#screen").attr("disabled", true);
  $("#leave").attr("disabled", true);
  hideMuteButton();
  console.log("client leaves channel success");
  updatePerticipates()
}

async function subscribe(user, mediaType) {
  const uid = user.uid;
  // subscribe to a remote user
  await client.subscribe(user, mediaType);
  console.log("subscribe success");

  // if the video wrapper element is not exist, create it.
  if (mediaType === 'video') {
    if ($(`#player-wrapper-${uid}`).length === 0) {
      const player = $(`
        <div id="player-wrapper-${uid}">
        <!-- <p class="player-name">remoteUser(${uid})</p> -->
          <div id="player-${uid}" class="player"></div>
        </div>
      `);
      $("#remote-playerlist").append(player);
    }

    // play the remote video.
    user.videoTrack.play(`player-${uid}`);
  }
  if (mediaType === 'audio') {
    user.audioTrack.play();
  }
}

function handleUserJoined(user) {
  const id = user.uid;
  remoteUsers[id] = user;
  updatePerticipates()
}

function handleUserLeft(user) {
  const id = user.uid;
  delete remoteUsers[id];
  $(`#player-wrapper-${id}`).remove();
  updatePerticipates()
}

function handleUserPublished(user, mediaType) {
  subscribe(user, mediaType);
}

function hideMuteButton() {
  $("#mute-video").css("display", "none");
  $("#mute-audio").css("display", "none");
  $("#screen").css("display", "none");
}

function showMuteButton() {
  $("#mute-video").css("display", "inline-block");
  $("#mute-audio").css("display", "inline-block");
  $("#screen").css("display", "inline-block");
}

async function muteAudio() {
  if (!localTracks.audioTrack) return;
  await localTracks.audioTrack.setEnabled(false);
  localTrackState.audioTrackEnabled = false;
  $("#mute-audio").text("Unmute Audio");
}

async function muteVideo() {
  if (!localTracks.videoTrack) return;
  await localTracks.videoTrack.setEnabled(false);
  localTrackState.videoTrackEnabled = false;
  $("#mute-video").text("Unmute Video");
}

async function unmuteAudio() {
  if (!localTracks.audioTrack) return;
  await localTracks.audioTrack.setEnabled(true);
  localTrackState.audioTrackEnabled = true;
  $("#mute-audio").text("Mute Audio");
}

async function unmuteVideo() {
  if (!localTracks.videoTrack) return;
  await localTracks.videoTrack.setEnabled(true);
  localTrackState.videoTrackEnabled = true;
  $("#mute-video").text("Mute Video");
}


hideMuteButton()


const muteUnmute = () => {
  if (localTrackState.audioTrackEnabled) {
    muteAudio()
    setUnmuteButton();
  } else {
    unmuteAudio()
    setMuteButton();
  }
}
 

const setMuteButton = () => {
  const html = `
    <i class="fas fa-microphone"></i>
    <span>Mute</span>
  `
  document.querySelector('.main__mute_button').innerHTML = html;
}

const setUnmuteButton = () => {
  const html = `
    <i class="unmute fas fa-microphone-slash"></i>
    <span>Unmute</span>
  `
  document.querySelector('.main__mute_button').innerHTML = html;
}  

const setStopVideo = () => {
  const html = `
    <i class="fas fa-video"></i>
    <span>Stop Video</span>
  `
  document.querySelector('.main__video_button').innerHTML = html;
}

const setPlayVideo = () => {
  const html = `
  <i class="stop fas fa-video-slash"></i>
      <span>Play Video</span>
  `
  document.querySelector('.main__video_button').innerHTML = html;
}



function myFunction() {
  var copyText = document.getElementById("myInput");
  copyText.select();
  copyText.setSelectionRange(0, 99999);
  document.execCommand("copy");
  
  var tooltip = document.getElementById("myTooltip");
  tooltip.innerHTML = "Copied: " + copyText.value;
}

function outFunc() {
  var tooltip = document.getElementById("myTooltip");
  tooltip.innerHTML = "Copy to clipboard";
}

document.addEventListener('contextmenu', event => event.preventDefault());

function updatePerticipates(){
  var len = Object.keys(remoteUsers).length + 1;
  document.querySelector('.per').innerHTML = `(${len})`
}