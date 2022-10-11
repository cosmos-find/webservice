const Service = require('webos-service');
const pkgInfo = require('./package.json');
const service = new Service(pkgInfo.name);
const logHeader = "[" + pkgInfo.name + "]";

// setting server
const express = require("express");
var cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

const creatToast = (message) => {
  let url = "luna://com.webos.notification/createToast";
  let params = {
    message: message
  };

  service.call(url, params, (m2) => {
    console.log(logHeader, "SERVICE_METHOD_CALLED:com.webos.notification/createToast");
  });
};

const createTTS = (message) => {
  let url = "luna://com.webos.service.tts/speak";
  let params = {
    text: message,
    language:"ko-KR",
    clear: true
  };

  service.call(url, params, (m2) => {
    console.log(logHeader, "SERVICE_METHOD_CALLED:com.webos.service.tts/speak");
  });
}

const closeOTTApp = () => {
  let url = "luna://com.webos.service.applicationmanager/close";
  let params = {
    id: "cosmos.find.ott.app"
  };

  service.call(url, params, (m2) => {
    console.log(logHeader, "SERVICE_METHOD_CALLED:com.webos.service.applicationmanager/close");
  });
}

app.patch('/EnterSleepMode', (req, res)=>{
  console.log('PATCH /EnterSleepMode', req.body);
  let data = req.body;
  if(typeof(data) == 'string') {
    data = JSON.parse(data);
  }

  creatToast('취침 모드에 들어갑니다.');
  setTimeout(closeOTTApp, 5000);

  res.send({"result":true});
});

app.patch('/CreateToast', (req, res)=>{
  console.log('PATCH /CreateToast', req.body);
  let data = req.body;
  if(typeof(data) == 'string') {
    data = JSON.parse(data);
  }

  creatToast(data.message);
  res.send({"result":true});
});

app.patch('/CreateTTS', (req, res)=>{
  console.log('PATCH /CreateTTS', req.body);
  let data = req.body;
  if(typeof(data) == 'string') {
    data = JSON.parse(data);
  }

  createTTS(data.message);
  res.send({"result":true});
});

let broadcaster;
const port = 9000;
const hostname = '0.0.0.0';

const http = require("http");
const server = http.createServer(app);

const io = require("socket.io")(server, {
  cors: {
    origin: "http://0.0.0.0:9000",
    methods: ["GET", "POST"]
  }
});

io.sockets.on("error", e => console.log(e));

app.use(express.static(__dirname + "/public")); // load files below /public

service.register("serverOn", (message) => {
  io.sockets.on("connection", socket => {
    console.log("onConnection 1 ");
    socket.on("broadcaster", () => {
      broadcaster = socket.id; // set the broadcaster
      socket.broadcast.emit("broadcaster"); // to all id
      console.log("broadcaster 2 ");
    });
    socket.on("watcher", () => {
      socket.to(broadcaster).emit("watcher", socket.id);
      console.log("watcher 3 ");
    });
    socket.on("disconnect", () => {
      socket.to(broadcaster).emit("disconnectPeer", socket.id);
      console.log("disconnect 4 ");
    });
  
    // initiate webrtc
    socket.on("offer", (id, message) => {
      socket.to(id).emit("offer", socket.id, message);
      console.log("server offer");
    });
    socket.on("answer", (id, message) => {
      socket.to(id).emit("answer", socket.id, message);
      console.log("server answer ");
    });
    socket.on("candidate", (id, message) => {
      socket.to(id).emit("candidate", socket.id, message);
      console.log("server candidate 2 ");
    });
  });
  
  server.listen(port, hostname, () => console.log(`Server is running on port http://${hostname}:${port}`));

 // ==== heartbeat 구독
 const sub = service.subscribe(`luna://${pkgInfo.name}/heartbeat`, {subscribe: true});
 const max = 500;
 let count = 0;
 sub.addListener("response", function(msg) {
     console.log(JSON.stringify(msg.payload));
     if (++count >= max) {
         sub.cancel();
         setTimeout(function(){
             console.log(max+" responses received, exiting...");
             process.exit(0);
         }, 1000);
     }
 });

 message.respond({
   returnValue: true,
   Response: "Webrtc_client Open"
 });
});


// handle subscription requests
const subscriptions = {};
let heartbeatinterval;
let x = 1;
function createHeartBeatInterval() {
   if (heartbeatinterval) {
       return;
   }
   console.log(logHeader, "create_heartbeatinterval");
   heartbeatinterval = setInterval(function() {
       sendResponses();
   }, 1000);
}

// send responses to each subscribed client
function sendResponses() {
   console.log(logHeader, "send_response");
   console.log("Sending responses, subscription count=" + Object.keys(subscriptions).length);
   for (const i in subscriptions) {
       if (Object.prototype.hasOwnProperty.call(subscriptions, i)) {
           const s = subscriptions[i];
           s.respond({
               returnValue: true,
               event: "beat " + x
           });
       }
   }
   x++;
}

var heartbeat = service.register("heartbeat");

heartbeat.on("request", function(message) {
   console.log(logHeader, "SERVICE_METHOD_CALLED:/heartbeat");
   message.respond({event: "beat"}); // initial response 
   if (message.isSubscription) { 
       subscriptions[message.uniqueToken] = message; //add message to "subscriptions" 
       if (!heartbeatinterval) {
           createHeartBeatInterval();
       }
   } 
});

heartbeat.on("cancel", function(message) { 
   delete subscriptions[message.uniqueToken]; // remove message from "subscriptions" 
   var keys = Object.keys(subscriptions); 
   if (keys.length === 0) { // count the remaining subscriptions 
       console.log("no more subscriptions, canceling interval"); 
       clearInterval(heartbeatinterval);
       heartbeatinterval = undefined;
   } 
});
