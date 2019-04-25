var readline = require("readline");
var dgram = require('dgram');

var pacotes = [];

var leitor = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

leitor.question("Informe o host: ", (host) => {

    leitor.question("Informe a porta: ", (port) => {
        
        leitor.question("Você é o player 1 ou 2? ", (player) => {
            
            leitor.question("Informe seu ip: ", (ip) => {
                leitor.close();

                var stdin = process.openStdin(); 
                stdin.setRawMode(true);
                var client = dgram.createSocket('udp4');
                var server = dgram.createSocket('udp4');
                let serverPort = 3002 + parseInt(player);

                server.bind(serverPort, ip, () => {
                    console.log("Escutando em: ", ip, serverPort);
                });
                
                stdin.on('keypress', function (key) {
                    if (key && key.ctrl && key.name == 'c') {
                        process.stdin.end();
                        client.close();
                    } else if(key && (key == 'w' || key == 's')) {
                        var pacote = {
                            "player": player,
                            "direction": (key == 'w') ? -1 : 1,
                            "num_pacote": pacotes.length + 1
                        }
                        pacotes.push(pacote);
                        let message = new Buffer(JSON.stringify(pacote));
                        client.send(message, 0, message.length, port, host, function(err) {
                            if (err) throw err;
                            console.log('movimento enviado para o servidor: ' + host +':'+ port);
                        });
                    }
                });

                server.on('message', (message, remote) => {
                    console.log("mensagem recebida");
                    if(message['type'] == 'not received') {
                        let message = new Buffer(JSON.stringify(pacotes[message['num_pacote']]));
                        client.send(message, 0, message.length, port, host, function(err) {
                            if (err) throw err;
                            console.log('movimento reenviado para o servidor: ' + host +':'+ port);
                        });
                    }
                });
            });
        });
    });

});