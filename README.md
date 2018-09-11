# f5-asg-trust-demo
## Create a Trusted Proxy from the API Gateway
```
npm install 
node f5-asg-trust-demo.js --help
```
## After install the Usage is as follows:

```
 Usage: node f5-asg-trust-demo.js [options]

  Options:

    -V, --version  output the version number
    --bigip-host  <value> BIG-IP host to add or remove from gateway trust
    --bigip-port  <value> BIG-IP management port
    --bigip-username <value> BIG-IP host username   
    --bigip-password <value> BIG-IP host password   
    --api-gw-http-host <value> API Gateway HTTP host 
    --api-gw-http-port <value> API Gateway HTTP port
    --device-group-name <value> API gateway trust device group
    --clean Removes trust and certificates
    --delete-all-device-certificates Force deletes all device certificates from the BIG-IP 
```
Examples:

Assuming you started the API Gateway wirh default options from Docker Hub

```
docker run -p 8443:443 -p 8080:80 f5devcentral/f5-api-services-gateway
```

You can run:

```
node f5-asg-trust-demo.js --bigip-host 192.168.245.1 --bigip-username admin --bigip-password admin --device-group-name app1
```

assuming your BIG-IP is reachable at https://192.168.245.1:443, you can issue trusted signed REST calls, without supplying further credentials, of the form:

```
POST http://localhost:8080/mgmt/shared/test/proxy-js

{ 
	"method": [Get,Post,Put,Patch,Delete], 
	"uri": [remote BIG-IP full uri], 
	"body": [request body] 
}
```

Example GET request:

```
POST http://localhost:8080/mgmt/shared/test/proxy-js

{ 
	"method": "Get", 
	"uri": "https://192.168.245.1/mgmt/shared/identified-devices/config/device-info"
}
```
