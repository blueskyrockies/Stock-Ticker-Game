var app = require('http').createServer(response);

var fs = require('fs');
var io = require('socket.io')(app);

var users=0;
var game_speed=6;

var players=[];
var stocks=[100,100,100,100,100,100];

app.listen(3000);
console.log("App running...");

var interval=setInterval(intervalFunc,2000);

function response(req, res) {
    var file = "";
    if(req.url == "/"){
	   file = __dirname + '/index.html';
    } else {
	   file = __dirname + req.url;
    }
   
    fs.readFile(file,
	    function (err, data) {
			if (err) {
				res.writeHead(404);
				return res.end('Page or file not found');
			}

			res.writeHead(200);
			res.end(data);
			
			console.log(getClientIp(req) + " Joined");
			console.log("Users:  " + ++users);
	    }
    );
}

io.on("connection", function(socket){
    socket.on("send message", function(sent_msg, callback){
		sent_msg = "" + sent_msg;

		io.sockets.emit("update chat messages", sent_msg);
		callback();
		
    });
	
	socket.on("New Player", function(sent_msg, callback){
		sent_msg = "" + sent_msg;
		if (search(sent_msg, players)) {
			
			io.sockets.emit("New Player Deny", sent_msg);
		} else {
			var person={
				name:"dummy",
				money:5000,
				stocks:[0,0,0,0,0,0]
			}
			person.name=sent_msg;
			players.push(person);
			console.log(sent_msg + " Just joined the game");
			io.sockets.emit("New Player Confirm", sent_msg);
		}
		callback();		
    });
	
	socket.on("buy", function(sent_msg, callback){
		sent_msg = "" + sent_msg;
		
		var obj=JSON.parse(sent_msg);
		
		io.sockets.emit("game chat", obj.name + ": Buying $" + obj.amount + " of " + obj.stock);		
		
		for(i=0;i<players.length;i++){			
			if (players[i].name==obj.name) {
					stockBuy(obj.name,obj.amount,obj.stock);
			}
		}
		
		callback();		
    });
	
	socket.on("sell", function(sent_msg, callback){
		sent_msg = "" + sent_msg;
		
		var obj=JSON.parse(sent_msg);
		
		io.sockets.emit("game chat", obj.name + ": Selling $" + obj.amount + " of " + obj.stock);		
		
		for(i=0;i<players.length;i++){			
			if (players[i].name==obj.name) {				
				stockSell(obj.name,obj.amount,obj.stock);								
			}
		}
		
		callback();	
    });
	
	socket.on("game control", function(sent_msg, callback){ //reset game received by some player
		sent_msg = "" + sent_msg;
				
		io.sockets.emit("game chat", sent_msg);		
		
		if (sent_msg.indexOf("***Game Reset by ")>-1){
			for(i=0;i<players.length;i++) {	
				players[i].money=5000;
				for(j=0;j<6;j++) {
					players[i].stocks[j]=0;
					stocks[j]=100;
				}
			}
		}
		if (sent_msg.indexOf("***Server Reset by ")>-1){
			for(j=0;j<6;j++) {				
				stocks[j]=100;
			}
			players=[];
			users=0;
		}
		
		callback();	
    });
	
	socket.on("new speed", function(sent_msg, callback){
		sent_msg = "" + sent_msg;
				
		io.sockets.emit("game chat", sent_msg);		
		
		if (sent_msg.indexOf("slow")>-1) game_speed=6;
		if (sent_msg.indexOf("medium")>-1) game_speed=4;
		if (sent_msg.indexOf("fast")>-1) game_speed=2;
		
		
		callback();	
    });
});

function stockCost(amt,stock) {
	var c=0;
	if (stock=="Grain") c=stocks[0];
	if (stock=="Gold") c=stocks[1];
	if (stock=="Bonds") c=stocks[2];
	if (stock=="Oil") c=stocks[3];
	if (stock=="Industrial") c=stocks[4];
	if (stock=="Silver") c=stocks[5];
	
	return amt*c/100;
}

function stockBuy(player,amt,stock) {
	var c=0;
	if (stock=="Grain") c=0;
	if (stock=="Gold") c=1;
	if (stock=="Bonds") c=2;
	if (stock=="Oil") c=3;
	if (stock=="Industrial") c=4;
	if (stock=="Silver") c=5;
	for(i=0;i<players.length;i++) {		
		if (player==players[i].name) {
			var cost=stockCost(amt,stock);
			if (players[i].money>=cost) {
				players[i].stocks[c]+=parseInt(amt);
				players[i].money-=cost;
			}else{
				io.sockets.emit("game chat", player + " You don't have enough to buy that much " + stock + "!");
			}
		}
	}
}

function stockSell(player,amt,stock) {
	var c=0;
	if (stock=="Grain") c=0;
	if (stock=="Gold") c=1;
	if (stock=="Bonds") c=2;
	if (stock=="Oil") c=3;
	if (stock=="Industrial") c=4;
	if (stock=="Silver") c=5;
	for(i=0;i<players.length;i++) {		
		if (player==players[i].name) {
			var sellAmount=parseInt(amt);
			if (sellAmount>players[i].stocks[c]){
				io.sockets.emit("game chat", player + " You don't have that much " + stock + " to sell!");
			}else{
				players[i].stocks[c]-=parseInt(amt);
				players[i].money+=stockCost(amt,stock);
			}
			
		}
	}
}

function rollDice() {
	var s=Math.floor(Math.random() * 6);
	var amt=Math.floor(Math.random() * 20)+1;
	var d=Math.floor(Math.random() * 6);
	if (s==0) stock="Grain";
	if (s==1) stock="Gold";
	if (s==2) stock="Bonds";
	if (s==3) stock="Oil";
	if (s==4) stock="Industrial";
	if (s==5) stock="Silver";
	
	if (d==0 || d==5) div="Up";
	if (d==1 || d==3) div="Down";
	if (d==2 || d==4) div="Dividend";
	
	io.sockets.emit("game chat", stock + " " + div + " " + amt);
	
	if (div=="Up") {
		stocks[s]+=amt;
		if(stocks[s]>=200){
			io.sockets.emit("game chat", stock + " SPLIT!!!");
			stocks[s]=100;
			for(i=0;i<players.length;i++) {	
				players[i].stocks[s]*=2;
			}
		}
	}
	
	if (div=="Down") {
		stocks[s]-=amt;
		if(stocks[s]<=0){
			io.sockets.emit("game chat", stock + " OFF MARKET!!!");
			stocks[s]=100;
			for(i=0;i<players.length;i++) {	
				players[i].stocks[s]=0;
			}
		}
	}
	
	if (div=="Dividend") {
		if(stocks[s]>=100){
			for(i=0;i<players.length;i++) {
				mydiv=Math.round(players[i].stocks[s]*amt/10);
				if (mydiv>0) {
					io.sockets.emit("game chat", "**" + stock + " Payout " + players[i].name + " $" + mydiv);
					players[i].money+=mydiv;
				}
			}
		}else{
			//io.sockets.emit("game chat", " No Dividend payout for-" + stock + "!!");
		}
	}
}

function intervalFunc() {	
	io.sockets.emit("main stock update", stocks.toString());	
	
	io.sockets.emit("players update", JSON.stringify(players));
	
	if (Math.floor(Math.random() * game_speed)==1) rollDice();
};

function getClientIp(req) {  
    return (req.headers["X-Forwarded-For"] || req.headers["x-forwarded-for"] || '').split(',')[0] || req.client.remoteAddress;
};

function search(nameKey, myArray){
    for (var i=0; i < myArray.length; i++) {
        if (myArray[i].name === nameKey) {
            return myArray[i];
        }
    }
}
