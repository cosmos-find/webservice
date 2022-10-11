let peerConnection;
const config = {
  iceServers: [
      { 
        "urls": "stun:stun.l.google.com:19302",
      }
  ]
};

// const socket = io.connect(window.location.origin);
const socket = io.connect('localhost:9000');
const video = document.querySelector("video");

socket.on("offer", (id, description) => {
  console.log("1");
  peerConnection = new RTCPeerConnection(config);
  peerConnection
    .setRemoteDescription(description)
    .then(() => peerConnection.createAnswer())
    .then(sdp => peerConnection.setLocalDescription(sdp))
    .then(() => {
      socket.emit("answer", id, peerConnection.localDescription);
    });
  peerConnection.ontrack = event => {
    video.srcObject = event.streams[0];
    console.log("2");
  };
  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      socket.emit("candidate", id, event.candidate);
      console.log("3", event.candidate);
    }
  };
});


socket.on("candidate", (id, candidate) => {
  console.log("4", candidate);
  peerConnection
    .addIceCandidate(new RTCIceCandidate(candidate))
    .catch(e => console.error(e));
});

socket.on("connect", () => {
  console.log("5");
  socket.emit("watcher");
});

socket.on("broadcaster", () => {
  console.log("6");
  socket.emit("watcher");
});

window.onunload = window.onbeforeunload = () => {
  console.log("7");
  socket.close();
  peerConnection.close();
};
