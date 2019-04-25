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
                let serverPort = 3002 + parseInt(player);

                client.bind(serverPort, ip, () => {
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
                        let message = new Buffer(JSON.stringify(pacote));
                        pacotes.push(message);
                        client.send(message, 0, message.length, port, host, function(err) {
                            if (err) throw err;
                            console.log('movimento enviado para o servidor: ' + host +':'+ port);
                        });
                    }
                });

                client.on('message', (pacoteJSON) => {
                    console.log("mensagem recebida");
                    let message = JSON.parse(pacoteJSON);
                    if(message['type'] == 'not received') {
                        let index = message['num_pacote'] - 1;
                        console.log(JSON.parse(pacotes[index]));
                        client.send(pacotes[index], 0, pacotes[index].length, port, host, function(err) {
                            if (err) throw err;
                            console.log('movimento reenviado para o servidor: ' + host +':'+ port);
                        });
                    }
                });
            });
        });
    });

});