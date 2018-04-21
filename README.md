# Graphegram-LIB
**graphegram-lib** - js-library for creating private p2p communication channels between GOLOS or STEEM users. All messages are stored in the BC, but only the sender and the recipient can read them.

---
## How does it work?
### First start
When the lib is launched for the first time, it requests a login, a password and a private key for posting. It only stores the username and password, shashed with the sha256 algorithm. The private posting key is encrypted using the OTP-algorithm with password hash, and is also saved. Thanks to this, it gives the assurance that noone will get the key when you will are out of keyboard.
### Channel creation
When someone wants to open a communication channel with you, the library will create an "invitation" to a private chat as a comment to the post created in the previous step and pass random public key to the comment. At the same time, your future interlocutor will generate a private key, which will be known only to them. When you respond to the chat invitation, you essentially perform the same operations as they do (generate a private and public key). This public key will be sent to your interlocutor.
### Communication process
When you know your private key, and two public keys (yours and your interlocutor), the library will generate an encryption and decryption keys using the ElGamal algorithm. Now you can safely exchange messages without fear that someone will understand them.

---
## Documentation
**TBD...**

---
## ETH-address
[0x92C1CF7AF140209a5f304F2F4782D7F5F1969950](https://etherscan.io/address/0x92C1CF7AF140209a5f304F2F4782D7F5F1969950)

![ethereum:0x92C1CF7AF140209a5f304F2F4782D7F5F1969950](https://raw.githubusercontent.com/fit4code/Documents/0ea7956d572ca1ef256406b15b274486c2c8551a/eth9250.png)
