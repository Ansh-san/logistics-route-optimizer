// dns-fix.js
// Forces Node.js to use Google Public DNS (8.8.8.8 / 8.8.4.4)
// instead of the system's default DNS resolver.
//
// Why: Some ISP routers (e.g. Reliance/Jio) cannot resolve MongoDB Atlas
// SRV records (_mongodb._tcp.*.mongodb.net), causing ECONNREFUSED.
// Google DNS handles them fine.

import dns from "node:dns";

dns.setServers(["8.8.8.8", "8.8.4.4"]);
