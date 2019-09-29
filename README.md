# onetimesecret-node
This is a clone of the popular app https://github.com/onetimesecret/onetimesecret , hosted at http://onetimesecret.com
I was unable to get the original to function due to Ruby version issues and conflicts. The node version is light and can be run by npm or pm2.

## Required to function
A redis server

## HOWTO
Starting with npm:
1. Edit package.json 
2. Replace {{key}} with a 64 character hex value for key
3. Replace {{iv}} with a 32 character hex value for iv
4. Add --redisHost and --redisPort arguments unless you prefer the defaults (localhost:6379)
5. Run with npm start

I hope you like it!
