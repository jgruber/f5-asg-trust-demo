#!/usr/bin/env node

'use strict';

const program = require('commander');
const request = require('request');
const colors = require('colors');

let validateF5DeviceTrust = (options) => {
    if (options.clean === undefined) {
        console.log(colors.green('validating BIG-IP exists'));
        getDeviceInfo(options)
            .then((machineId) => {
                options.bigipMachineId = machineId;
                console.log(colors.green('validating API Gateway'));
                return getGatewayInfo(options);
            })
            .then((machineId) => {
                options.gatewayMachineId = machineId;
                console.log(colors.yellow('creating device group on API Gateway'));
                return createTrustGroup(options);
            })
            .then(() => {
                console.log(colors.yellow('establishing device trust'));
                return establishDeviceTrust(options);
            })
            .then(() => {
                console.log(colors.green('trusted requests can be made through the API Gateway at /mgmt/shared/test/proxy-js'))
                let usage_message = "\nAll proxy requests are of the form: \n\n";
                usage_message += "POST http://" + options.apiGwHttpHost + ":" + options.apiGwHttpPort + "/mgmt/shared/test/proxy-js";
                usage_message += "\n\n{ \n\t\"method\": [Get,Post,Put,Patch,Delete], \n\t\"uri\": [remote BIG-IP full uri], \n\t\"body\": [request body] \n}\n\n"
                usage_message += "\nExample:\n\n";
                usage_message += "POST http://" + options.apiGwHttpHost + ":" + options.apiGwHttpPort + "/mgmt/shared/test/proxy-js";
                usage_message += "\n\n{ \n\t\"method\": \"Get\", \n\t\"uri\": "
                usage_message += "\"https://" + options.bigipHost + ":" + options.bigipPort + "/mgmt/shared/identified-devices/config/device-info\"\n}\n\n";
                console.log(colors.green(usage_message));
            })
            .catch(err => {
                console.log(colors.red('Can get device info.. cancelling request. ' + err));
                process.exit(1);
            })
    } else {
        console.log(colors.green('validating BIG-IP exists'));
        getDeviceInfo(options)
            .then((machineId) => {
                options.bigipMachineId = machineId;
                console.log(colors.green('validating API Gateway'));
                return getGatewayInfo(options);
            })
            .then((machineId) => {
                options.gatewayMachineId = machineId;
                return deleteGatewayCertificateFromBIGIP(options);
            })
            .then(() => {
                return deleteDeviceCertificateFromGw(options);
            })
            .then(() => {
                return deleteDeviceFromTrustGroup(options);
            })
            .then(() => {
                return deleteTrustGroup(options);
            })
            .then(() => {
                return deleteAllDeviceCertificates(options)
            })
            .then(() => {
                console.log(colors.green('REST requests proxied through API Gateway are no longer trusted.'))
            })
            .catch(err => {
                console.log(colors.red('Can get device info.. cancelling request. ' + err));
                process.exit(1);
            })
    }
}

const getGatewayInfo = (options) => {
    return new Promise((resolve, reject) => {
        const gw_path = '/mgmt/shared/identified-devices/config/device-info';
        const req_options = {
            url: 'http://' + options.apiGwHttpHost + ":" + options.apiGwHttpPort + "/" + gw_path,
            json: true
        }
        request.get(req_options, (err, resp, body) => {
            if (err) {
                throw Error(err);
            }
            resolve(body.machineId);
        })
    });
};

const getDeviceInfo = (options) => {
    return new Promise((resolve, reject) => {
        const di_path = '/mgmt/shared/identified-devices/config/device-info';
        const req_options = {
            url: 'https://' + options.bigipHost + ":" + options.bigipPort + "/" + di_path,
            auth: {
                username: options.bigipUsername,
                password: options.bigipPassword
            },
            rejectUnauthorized: false,
            requestCert: true,
            json: true
        }
        request.get(req_options, (err, resp, body) => {
            if (err) {
                throw Error(err);
            }
            resolve(body.machineId);
        })
    });
};

const createTrustGroup = (options) => {
    return new Promise((resolve, reject) => {
        const dg_path = '/mgmt/shared/resolver/device-groups';
        const get_options = {
            url: 'http://' + options.apiGwHttpHost + ':' + options.apiGwHttpPort + "/" + dg_path,
            json: true
        }
        request.get(get_options, (err, resp, body) => {
            if (err) {
                throw Error(err);
            }
            let dg_found = false;
            body.items.map((dg, idx) => {
                if (dg.groupName == options.deviceGroupName) {
                    dg_found = true;
                }
            });
            if (dg_found) {
                resolve();
                return
            } else {
                const create_body = {
                    "groupName": options.deviceGroupName,
                    "display": "API Gateway Trust Group",
                    "description": "API Gateway Trust Group"
                }
                const post_options = {
                    url: 'http://' + options.apiGwHttpHost + ':' + options.apiGwHttpPort + "/" + dg_path,
                    body: create_body,
                    json: true
                }
                request.post(post_options, (err, resp, body) => {
                    if (err) {
                        throw Error(err);
                    }
                    resolve();
                    return
                });
            }
        })
    });
};

const deleteGatewayCertificateFromBIGIP = (options) => {
    return new Promise((resolve, reject) => {
        const cert_get_options = {
            url: 'https://' + options.bigipHost + ':' + options.bigipPort + "/mgmt/shared/device-certificates",
            auth: {
                username: options.bigipUsername,
                password: options.bigipPassword
            },
            rejectUnauthorized: false,
            requestCert: true,
            json: true
        };
        request.get(cert_get_options, (err, resp, body) => {
            if (err) {
                throw Error(err);
            }
            let cert_not_found = true;
            body.items.map((cert, idx) => {
                if (cert.machineId === options.gatewayMachineId) {
                    cert_not_found = false;
                    const del_options = {
                        url: 'https://' + options.bigipHost + ':' + options.bigipPort + "/mgmt/shared/device-certificates/" + cert.certificateId,
                        auth: {
                            username: options.bigipUsername,
                            password: options.bigipPassword
                        },
                        rejectUnauthorized: false,
                        requestCert: true,
                        json: true
                    }
                    request.del(del_options, (err, resp) => {
                        if (err) {
                            throw Error(err);
                        }
                        resolve();
                    });
                }
            });
            if (cert_not_found) {
                resolve();
            }
        })
    });
}

const deleteDeviceCertificateFromGw = (options) => {
    return new Promise((resolve, reject) => {
        const dc_path = '/mgmt/shared/device-certificates';
        const get_options = {
            url: 'http://' + options.apiGwHttpHost + ':' + options.apiGwHttpPort + "/" + dc_path,
            json: true
        }
        request.get(get_options, (err, resp, body) => {
            if (err) {
                throw Error(err);
            }
            let cert_not_found = true;
            body.items.map((cert, idx) => {
                if (cert.machineId === options.bigipMachineId) {
                    cert_not_found = false;
                    const del_options = {
                        url: 'http://' + options.apiGwHttpHost + ':' + options.apiGwHttpPort + "/" + dc_path + "/" + cert.certificateId
                    }
                    request.del(del_options, (err, resp, body) => {
                        if (err) {
                            throw Error(err);
                        }
                        resolve();
                    });
                }
            });
            if (cert_not_found) {
                resolve();
            }
        });
    });
}

const deleteDeviceFromTrustGroup = (options) => {
    return new Promise((resolve, reject) => {
        const dg_path = '/mgmt/shared/resolver/device-groups/' + options.deviceGroupName;
        const get_options = {
            url: 'http://' + options.apiGwHttpHost + ':' + options.apiGwHttpPort + dg_path + '/devices',
            json: true
        }
        let device_not_found = true;
        request.get(get_options, (err, resp, body) => {
            if (resp.statusCode == 404) {
                resolve();
            } else {
                body.items.map((device, idx) => {
                    if (device.deviceUri === 'https://' + options.bigipHost + ":" + options.bigipPort) {
                        device_not_found = false;
                        const del_options = {
                            url: 'http://' + options.apiGwHttpHost + ':' + options.apiGwHttpPort + dg_path + '/devices/' + device.uuid,
                            json: true
                        }
                        request.del(del_options, (err, resp, body) => {
                            if (err) {
                                throw Error(delerr);
                            }
                            resolve();
                        })
                    }
                });
            }
            if (device_not_found) {
                resolve();
            }
        });
    });
}

const deleteTrustGroup = (options) => {
    return new Promise((resolve, reject) => {
        const dg_path = '/mgmt/shared/resolver/device-groups/' + options.deviceGroupName;
        const get_options = {
            url: 'http://' + options.apiGwHttpHost + ':' + options.apiGwHttpPort + "/" + dg_path + '/devices',
            json: true
        }
        request.get(get_options, (err, resp, body) => {
            if (err) {
                throw Error(err);
            }
            if (resp.statusCode == 404) {
                resolve();
                return
            }
            if (body.items.length == 1) {
                const del_device_options = {
                    url: 'http://' + options.apiGwHttpHost + ':' + options.apiGwHttpPort + "/" + dg_path + '/devices/' + body.items[0].uuid,
                }
                request.del(del_device_options, (err, resp) => {
                    if (err) {
                        throw Error(err);
                    }
                    const delete_dg_options = {
                        url: 'http://' + options.apiGwHttpHost + ':' + options.apiGwHttpPort + "/" + dg_path
                    }
                    request.del(delete_dg_options, (err, resp) => {
                        if (err) {
                            throw Error(errr);
                        }
                        resolve();
                    });
                });
            } else {
                resolve();
            }
        });
    });
}

const deleteAllDeviceCertificates = (options) => {
    return new Promise((resolve, reject) => {
        if (options.deleteAllDeviceCertificates) {
            console.log(colors.yellow('forcing the deletion of all BIG-IP device certificates'));
            const cert_get_options = {
                url: 'https://' + options.bigipHost + ':' + options.bigipPort + "/mgmt/shared/device-certificates",
                auth: {
                    username: options.bigipUsername,
                    password: options.bigipPassword
                },
                rejectUnauthorized: false,
                requestCert: true,
                json: true
            }
            request.get(cert_get_options, (err, resp, body) => {
                if (err) {
                    throw Error(err);
                }
                let promises = body.items.map((cert, idx) => {
                    return deleteBIGIPCertificate(options, cert);
                });
                Promise.all(promises).then(() => {
                    resolve();
                })
            });
        } else {
            resolve();
        }
    });
}

const establishDeviceTrust = (options) => {
    return new Promise((resolve, reject) => {
        const dg_path = '/mgmt/shared/resolver/device-groups/' + options.deviceGroupName;
        const get_options = {
            url: 'http://' + options.apiGwHttpHost + ':' + options.apiGwHttpPort + "/" + dg_path + "/devices",
            json: true
        }
        request.get(get_options, (err, resp, body) => {
            if (err) {
                throw Error(err);
            }
            let device_found = false;
            if (resp.statusCode != 404) {
                body.items.map((device, idx) => {
                    if (device.deviceUri === 'https://' + options.bigipHost + ":" + options.bigipPort) {
                        device_found = true;
                    }
                });
            }
            if (device_found) {
                console.log(colors.red('WARNING: device already exists on API gateway trust group'));
                resolve();
                return
            } else {
                const create_body = {
                    "userName": options.bigipUsername,
                    "password": options.bigipPassword,
                    "address": options.bigipHost,
                    "httpsPort": options.bigipPort
                };
                const post_options = {
                    url: 'http://' + options.apiGwHttpHost + ':' + options.apiGwHttpPort + "/" + dg_path + "/devices",
                    body: create_body,
                    json: true
                }
                request.post(post_options, (err, resp, body) => {
                    if (err) {
                        throw Error(err);
                    }
                });
                resolve();
                return
            }
        })
    });
};

let list = (val) => {
    return val.split(',');
}

program
    .version('1.0.0')
    .option('--bigip-host <value>', 'BIG-IP host to add or remove from gateway trust (required)')
    .option('--bigip-port <value>', 'BIG-IP management port (required)', 443)
    .option('--bigip-username <value>', 'BIG-IP host username (required)', 'admin')
    .option('--bigip-password <value>', 'BIG-IP host password (required)')
    .option('--api-gw-http-host <value>', 'API gateway HTTP host', 'localhost')
    .option('--api-gw-http-port <value>', 'API gateway HTTP port', 8080)
    .option('--device-group-name <value>', 'API gateway trust device group name', 'dockerContainers')
    .option('--clean', 'Remove certificates and devices')
    .option('--delete-all-device-certificates', 'Force deletion of all BIG-IP device certificates if cleaning')

program.on('--help', () => {
    console.log(`
Examples:

        node f5-asg-trust-builder.js
            --bigip-host 192.168.245.1
            --bigip-port 443
            --bigip-username admin
            --bigip-password admin
            --device-group-name dockerContainer
            --clean

        node f5-asg-trust-builder.js 
            --bigip-host 172.13.1.103
            --bigip-port 443
            --bigip-username admin 
            --bigip-password admin
            --device-group-name webapp1
            --api-gw-http-host f5gw
            --apt-gw-http-port 8080

        node f5-asg-trust-builder.js 
            --bigip-host 172.13.1.103
            --bigip-port 443
            --bigip-username admin 
            --bigip-password admin
            --device-group-name service1
            --clean
            --delete-all-device-certificates

    `);
});

if (process.argv.length == 2) {
    process.argv.push('--help');
}

program.parse(process.argv);

validateF5DeviceTrust(program);