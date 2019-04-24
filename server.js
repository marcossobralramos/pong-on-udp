var express = require('express');
var app = express();
var http = require('http').Server(app);
var ioTCP = require('socket.io')(http);

// tcp
const PORT_TCP = 3001;
http.listen(PORT_TCP, () => {
	console.log('TCP na porta ' + PORT_TCP);
});

// udp
const PORT_UDP = 3002;
var dgram = require('dgram');
var serverUDP = dgram.createSocket('udp4');
serverUDP.bind(PORT_UDP, "127.0.0.1", () => {
	console.log('UDP na porta ' + PORT_UDP);
});

// variáveis para a lógica do game online
var playersAssist = new Array();
var player1 = {
	'points': 0,
	'victories': 0
};

var player2 = {
	'points': 0,
	'victories': 0
};

// configuração para arquivos estáticos
app.use('/static', express.static(__dirname + '/static'));
app.use(express.static(__dirname + '/static'));

// configuração da view
app.set('views', './views');
app.set('view engine', 'jade');

// configuração das rotas
app.get('/', function (req, res) {
	res.render('login', {});
});

app.get('/game', function(req, res) {
	res.render('game', {});
});

// tratando mensagens via socket
ioTCP.on('connection', function(socket) {
	socket.on('connect player', function(json){
		player = JSON.parse(json);
		player["socket"] = socket;
		player["ip"] = socket.handshake.address;
		player["points"] = 0;
		player["victories"] = 0;

		playersAssist.push(player);
		player.socket.emit('players connected', null);
	});

	// registrando uma nova instância de socket para um jogador
	socket.on('register new socket', function(ip){
		console.log(ip);
		let exist = false;
		playersAssist.forEach((player) => {
			if(player["ip"] == ip){
				player['socket'] = socket;
				exist = true;
				return;
			}
		});
		if(!exist){
			let player = {
				"socket": socket,
				"ip": ip
			}
			playersAssist.push(player);
		}
	});

	socket.on('get players points', function(){
		let points = JSON.stringify({
			"me" : player1['points'],
			"adv" : player2['points']
		})
		playersAssist.forEach((player) => {
			player['socket'].emit('get players points', points);
		});
	});

	socket.on('get players victories', function(){
		let victories = JSON.stringify({
			"me" : player1['victories'],
			"adv" : player2['victories']
		})
		playersAssist.forEach((player) => {
			player['socket'].emit('get players victories', victories);
		});
	});

	socket.on('up point', function(numPlayer){
		if(numPlayer == 1) {
			player1['points']++;
			if(player1['points'] == 10) {
				player1['points'] = 0;
				player2['points'] = 0;
				player1['victories']++;
				playersAssist.forEach((player) => {
					player['socket'].emit('player win', 1);
				});
			}
		} else {
			player2['points']++;
			if(player2['points'] == 10) {
				player1['points'] = 0;
				player2['points'] = 0;
				player2['victories']++;
				playersAssist.forEach((player) => {
					player['socket'].emit('player win', 2);
				});
			}
		}

		let points = JSON.stringify({
			"player1" : player1['points'],
			"player2" : player2['points'],
		});

		playersAssist.forEach((player) => {
			player['socket'].emit('update score', points);
		});
	
	});

	socket.on('move ball', function(dt){
		playersAssist.forEach((player) => {
			player['socket'].emit('move ball', dt);
		});
	});

	socket.on('draw click', function(data){
		let v = JSON.parse(data);

		if(v.x === 0 && v.y === 0) 
		{
			v.x = Math.random() * 500 - 150;
			v.y = Math.random() * 500 - 150;
			playersAssist.forEach((player) => {
				console.log(player['ip']);
				player['socket'].emit('draw click', v);
			});
		}
	});

	socket.on('receive message', function(data){
		let ip = socket.handshake.address;
		let player_adv = players_adv[''+ip];
		let player_this = players_adv[''+player_adv['ip']];
		player_adv['socket'].emit('receive message', data);
		player_this['socket'].emit('receive message', data);
	});
});

let pacotes_pendentes = [[], []]; // cada índice representa um player
let proximo_pacote_players = [1,1]; // cada índice representa um player

serverUDP.on("message", (pacote, remote) => {
	let pacoteJSON = JSON.parse(pacote);
	let proximo_pacote = proximo_pacote_players[pacoteJSON['player']-1];
	console.log("num: ", pacoteJSON['num_pacote'], "prox: ", proximo_pacote);
	if(pacoteJSON['num_pacote'] > proximo_pacote) { 
		// se o pacote recebido não for da ordem esperada 
		// ...uma mensagem é enviada ao cliente pedindo para que o pacote seja enviado novamente
		let pacote2 = {
			"type": "not received",
			"num_pacote": proximo_pacote,
		}

		let message = new Buffer(JSON.stringify(pacote2));

		let clientPort = 3002 + parseInt(pacoteJSON['player']);
		serverUDP.send(message, 0, message.length, clientPort, remote.address, function(err) {
			if (err) throw err;
			console.log('solicitando pacote perdido em: ' + remote.address +':'+ clientPort);
		});

		// o pacote recebido é guardado no array do player que enviou
		pacotes_pendentes[pacoteJSON['player']-1].push(pacoteJSON);

	} else if (pacote['num_pacote'] == proximo_pacote) { 
		// caso seja o pacote esperado, envia-se o mesmo e todos os outros pacotes pendentes
		playersAssist.forEach((player) => {
			player['socket'].emit('move paddle ' + pacoteJSON['player'], pacoteJSON['direction']);
			console.log('move paddle ' + pacote['player'] + ' | direction: ' + pacote['direction']);
			let x = 0;
			for(; x < pacotes_pendentes.length; x++) {
				pacote = pacotes_pendentes.shift();
				player['socket'].emit('move paddle ' + pacote['player'], pacote['direction']);
				console.log('move paddle ' + pacote['player'] + ' | direction: ' + pacote['direction']);
			}
			proximo_pacote = x + 1; // atualiza o número do próximo pacote
			console.log("x: ", x);
		});
	} // caso seja menor que o esperado, ignora-se
});