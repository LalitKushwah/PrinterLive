var WebSocket = require('ws')
var sh = require('/usr/local/lib/node_modules/shelljs')

var command
var epsonPrinterDevices =""
var epsonPrinterLocation=""
var zbraPrinterDevices =""
var zebraPrinterQueue=""
var piMac = ""

var piMac = (sh.exec('ifconfig | grep HWaddr', {silent:true}).stdout).split(" ")[10]

var usb_device = sh.exec('lsusb', {silent:true}).stdout                         //check for printers connected via USB
var usb_device_array = usb_device.split("\n")
for (i=0;i<usb_device_array.length;i++){
    if (usb_device_array[i].toLowerCase().indexOf("epson")>-1) {
        epsonPrinterDevices += usb_device_array[i].substring(33).trim()+"@"
        epsonPrinterLocation += usb_device_array[i].substring(23,32)+"@"
    } else if (usb_device_array[i].toLowerCase().indexOf("zebra")>-1) {
        zebraPrinterDevices += usb_device_array[i].substring(33).trim()+"@"
    }
}

var network_device = sh.exec('/usr/lib/cups/backend/snmp', {silent:true}).stdout
var network_device_array = network_device.toString().split("\n")
for (i=0;i<network_device_array.length;i++){                                    //check for printers connected via lan
    if (network_device_array[i].toLowerCase().indexOf("epson")>-1){
        epsonPrinterLocation += network_device_array[i].substring(network_device_array[i].lastIndexOf("/")+1,network_device_array[i].indexOf("\"")-1)+"@"
        epsonPrinterDevices += (network_device_array[i].split('\"')[1])+"@"
     }
}

if (zebraPrinterDevices.localeCompare("")) {                                  //Create queue if there is any zebra printer
    var printers = (sh.exec("lpinfo -v ", {silent:true}).stdout).split("\n")
    var printer_no = 0
    for (i=0;i<printers.length;i++) {
        if((printers[i].indexOf("usb")>-1) && (printers[i].toLowerCase().indexOf("zebra")>-1)) {
            var zebra = printers[i].split(" ")
           var zebra_uri = (zebra[1].replace("(", "\\(")).replace(")", "\\)")
            command = "sudo lpadmin -p Zebra_lab"+printer_no+" -E -v "+zebra_uri
            sh.exec(command, {silent:true})
            zebraPrinterQueue += "Zebra_lab"+printer_no+"@"
            printer_no++
       }
    }
}

var socket = new WebSocket('ws://172.20.20.193:8080/websocket/websocket');
socket.on("message",function(message){
		try{
                  var obj = JSON.parse(message);
                  if(!obj.event.localeCompare("label")) {
                    var cmd = "zebra "+obj.itemName+" "+obj.deliveryDate+" "+obj.queue;
                    console.log(cmd)
                    sh.exec(cmd, {silent:true})
                  }
                  if(!obj.event.localeCompare("receipt")) {
                    var i;
                    var total_items = parseInt(obj.quantity);
                    var cmd = "epson "+obj.Interface+" "+obj.id+" ";
                    var item = (obj.items).split(" ");
                    var cost = (obj.costs).split(" ");
                    for (i=0;i<total_items;i++) {
                        cmd += item[i]+" "+cost[i]+" ";
                    }
                    console.log(cmd)
                    sh.exec(cmd, {silent:true})
                  }
		} catch (JSONException e) {
                e.printStackTrace();
            	}
});

socket.on('open', function (data_string) {              //Respond to available printer query
    var devices = "{\"event\":\"info\",\"epDev\" : \""+epsonPrinterDevices+"\",\"epLoc\" :\""+ epsonPrinterLocation+"\", \"zbDev\" :\""+ zebraPrinterDevices+"\", \"zbQue\" : \""+zebraPrinterQueue+"\", \"mac\":\""+ piMac+"\"}"
    socket.send(devices);
    console.log(devices)
});


