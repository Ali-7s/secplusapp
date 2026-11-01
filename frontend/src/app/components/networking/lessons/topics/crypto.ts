import { MatchQuestion } from '../../../../models/exam.model';
import { LessonBody } from '../../networking.model';
import { analogy, exam, examPbqs, h, hashLab, keys, list, mcq, p, pbq, recap, steps, table, tip, trap, words } from '../dsl';

const CRYPTO_TOOLS: MatchQuestion = {
  id: 'topic-crypto-tools', domain: 1, objective: '1.4', kind: 'match',
  scenario: 'A security team has a list of jobs, and each one needs a different cryptographic tool.',
  stem: 'Choose the tool that BEST fits each job.',
  choices: ['Symmetric encryption', 'Asymmetric encryption', 'Hashing', 'Digital signature', 'HMAC', 'Salted, stretched hash', 'Key exchange'],
  prompts: [
    { label: 'Encrypt a 2 TB backup drive quickly', answer: 'Symmetric encryption', why: 'Bulk data needs speed, and symmetric ciphers such as AES are fast. Asymmetric encryption would take far too long for terabytes.' },
    { label: 'Let a partner send you files that only you can open, without ever meeting to share a secret', answer: 'Asymmetric encryption', why: 'You publish your public key. Anything locked with it opens only with your private key, which never leaves you.' },
    { label: 'Let users check that the installer they downloaded is exactly the one on the website', answer: 'Hashing', why: 'The site lists the installer\'s hash. Users hash their copy and compare: any change, even one bit, gives a different hash.' },
    { label: 'Prove that the finance director approved a payment, in a way she cannot later deny', answer: 'Digital signature', why: 'Only she holds her private key, so a signature that verifies with her public key proves it was her. That is non-repudiation.' },
    { label: 'Two servers that already share a secret key check that each API message was not changed on the way', answer: 'HMAC', why: 'An HMAC is a hash mixed with the shared key. It proves integrity and that the sender knows the key, without the cost of a signature.' },
    { label: 'Store user passwords in a database', answer: 'Salted, stretched hash', why: 'Passwords are never stored, only salted hashes made slow on purpose (bcrypt, PBKDF2), so a stolen table resists rainbow tables and guessing.' },
    { label: 'Two parties who have never met agree on a fresh session key over an open network, without ever sending the key', answer: 'Key exchange', why: 'Diffie-Hellman lets both sides compute the same secret from values they swap in the open. An eavesdropper sees the values but cannot work out the secret.' },
  ],
  takeaway: 'Ask what the job needs: secrecy for lots of data (symmetric), secrecy without a shared secret (asymmetric), proof of no change (hash), proof of who (signature), a check between key holders (HMAC), password storage (salted, stretched hash), or a shared key from scratch (key exchange).',
};

export const CRYPTO: LessonBody = {
  goals: [
    'Say which of the three jobs (secrecy, no changes, proof of sender) encryption, hashing and signatures each do',
    'Explain symmetric and asymmetric encryption, and why real systems use both',
    'Choose the right key, yours or the other person\'s, public or private, for encrypting and for signing',
    'Explain what a hash is, why salts and key stretching protect passwords, and which algorithms are broken',
    'Follow how TLS combines key exchange, a session key and a signature',
  ],
  blocks: [
    recap('**HTTPS** is web traffic protected by **TLS** (Networking lessons 5 and 10). Nothing else is needed: this topic starts from scratch.'),
    words(
      ['Plaintext', 'Readable data before it is encrypted'],
      ['Ciphertext', 'Scrambled data after encryption. Useless without the key'],
      ['Algorithm (cipher)', 'The public recipe for scrambling and unscrambling, such as AES'],
      ['Key', 'The secret value fed into the algorithm. Change the key and the output changes completely'],
      ['Symmetric', 'One shared key both locks and unlocks'],
      ['Asymmetric', 'Two linked keys, a public one and a private one: what one locks, only the other unlocks'],
      ['Key pair', 'A matching public key and private key, made together'],
      ['Hash (digest)', 'A fixed-length fingerprint of some data. It cannot be turned back into the data'],
      ['Collision', 'Two different inputs that give the same hash. A good hash makes this practically impossible to find'],
      ['Salt', 'A random value added to a password before hashing, stored next to the hash'],
      ['Key stretching', 'Hashing over and over (thousands of times) so each password guess is slow'],
      ['Digital signature', 'A hash encrypted with the sender\'s private key. Proves who sent something and that it is unchanged'],
      ['Non-repudiation', 'The sender cannot deny sending it, because only they could have made the signature'],
      ['Key exchange', 'A way for two sides to end up with the same secret key without sending it'],
      ['Session key', 'A temporary symmetric key used for one connection, then thrown away'],
      ['HMAC', 'A hash mixed with a shared secret key: proves integrity between two key holders'],
    ),

    h('The three jobs cryptography does', { keep: 'Encryption keeps data secret (confidentiality). Hashing proves it has not changed (integrity). A digital signature proves who sent it, and they cannot deny it (authenticity and non-repudiation).' }),
    p('Cryptography sounds like one thing, but it does three different jobs. Most exam questions come down to spotting **which job** a scenario needs, then picking the tool that does that job.'),
    table(
      ['Job', 'The question it answers', 'Tool', 'Security word'],
      [
        ['Keep it secret', 'Can anyone else read this?', 'Encryption', 'Confidentiality'],
        ['Prove it has not changed', 'Is this exactly what was sent?', 'Hashing', 'Integrity'],
        ['Prove who sent it', 'Did it really come from them, and can they deny it?', 'Digital signature', 'Authenticity and non-repudiation'],
      ],
    ),
    analogy('Encryption is a **locked box**: nobody can see inside without the key. A hash is a **tamper seal**: it does not hide anything, but you can tell if the box was opened. A signature is a **wax seal with someone\'s ring**: only one person owns that ring.'),
    p('**Encryption** turns readable **plaintext** into scrambled **ciphertext** using an **algorithm** (the recipe) and a **key** (the secret). Decryption reverses it with the right key. The algorithms are public and well studied; all the secrecy lives in the key. That is why a longer key, with more possible values to guess, is stronger.'),
    trap('Encoding is not encryption. **Base64** turns data into letters and digits so it can travel safely, but anyone can decode it: there is no key. If an exam question shows a "password" like `cGFzc3dvcmQ=` in a config file, it is only encoded, not protected.'),

    h('Symmetric encryption: one shared key', { keep: 'Symmetric encryption uses the same key to lock and unlock. It is fast, so it encrypts the actual data (AES). Its weakness is getting that key to the other side safely.' }),
    p('With **symmetric** encryption, the same key encrypts and decrypts. It is fast, even on huge amounts of data, so it does the heavy lifting everywhere: disk encryption, VPN traffic, Wi-Fi, and the data inside every HTTPS page.'),
    table(
      ['Algorithm', 'Status', 'Notes'],
      [
        ['AES (128, 192 or 256-bit keys)', 'Use it', 'The standard. AES-256 is the usual "strongest" answer. Works on 128-bit blocks of data.'],
        ['ChaCha20', 'Use it', 'A fast modern stream cipher, common on phones'],
        ['3DES (Triple DES)', 'Legacy, retired', 'DES run three times. Slow, and withdrawn by NIST'],
        ['DES', 'Broken', '56-bit key, cracked by brute force in hours'],
        ['RC4', 'Broken', 'An old stream cipher with known weaknesses (it sank WEP Wi-Fi)'],
      ],
      { caption: 'Symmetric algorithms you may see' },
    ),
    p('Symmetric ciphers come in two styles. A **block cipher** (AES) encrypts fixed-size blocks, such as 128 bits at a time. A **stream cipher** (ChaCha20, RC4) encrypts one bit or byte at a time as the data flows. Block ciphers need a **mode** to handle data longer than one block; **GCM** is the modern one and also checks integrity, while **ECB** is the weak one that leaks patterns.'),
    p('The catch is **key distribution**. Both sides need the same key before they can talk, and sending that key over the network would let an eavesdropper copy it. It also scales badly: every pair of people needs its own key, so 100 people need 4,950 keys.'),
    analogy('Symmetric encryption is a **house key**. Fast and simple, but you have to get a copy to your friend somehow, and anyone who copies it on the way can let themselves in.'),

    h('Asymmetric encryption: a key pair', { keep: 'Everyone has a key pair: a public key anyone may hold and a private key only they hold. What one key locks, only the other unlocks. To send a secret, lock it with the recipient\'s public key.' }),
    p('**Asymmetric** encryption solves the key distribution problem with two mathematically linked keys, made together as a **key pair**:'),
    list(
      'The **public key** is shared with everyone: published on a website, sent in an email, put in a certificate. There is no harm in anyone having it.',
      'The **private key** never leaves its owner. Lose it or leak it, and the whole pair has to be replaced.',
      'What one key locks, **only the other key** of the same pair unlocks. You cannot work out the private key from the public one.',
    ),
    p('So to send Bob a secret, Alice locks it with **Bob\'s public key**. Anyone can do that, but only **Bob\'s private key** opens it, and only Bob has that. Alice and Bob never had to meet or share a secret. Try it:'),
    keys('Which key? Sending a secret', [
      { goal: 'Alice sends Bob a message that only Bob can read.', verbs: ['Encrypt with', 'Decrypt with'], answer: ['bob-public', 'bob-private'], why: 'Anyone can lock a message with Bob\'s public key, but only Bob\'s private key opens it. To keep something secret **for** someone, use **their** keys.' },
      { goal: 'Bob replies with a message that only Alice can read.', verbs: ['Encrypt with', 'Decrypt with'], answer: ['alice-public', 'alice-private'], why: 'Now Alice is the reader, so Bob locks the reply with Alice\'s public key and only her private key opens it.' },
    ], 'Pick a key for each half of the job. Alice\'s keys are blue and Bob\'s are amber; a dashed outline is a public key and a solid fill is a private key.'),
    table(
      ['Algorithm', 'Used for', 'Notes'],
      [
        ['RSA', 'Encryption, signatures, key exchange', 'Keys of 2,048 bits or more. Strength comes from factoring huge numbers'],
        ['ECC (elliptic curve)', 'Signatures, key exchange', 'Much shorter keys for the same strength (256-bit ECC is about as strong as 3,072-bit RSA), so it suits phones and small devices'],
        ['Diffie-Hellman (DH, ECDH)', 'Key exchange only', 'Lets two sides agree on a shared secret (more on this below)'],
        ['DSA, ECDSA', 'Signatures only', 'Signature algorithms; ECDSA is the elliptic curve version'],
      ],
      { caption: 'Asymmetric algorithms you may see' },
    ),
    p('The downside: asymmetric encryption is **slow**, hundreds to thousands of times slower than AES. So it is never used to encrypt bulk data. It is used for small, important things: a symmetric key, or the hash inside a signature.'),

    h('Hashing: a fingerprint of data', { keep: 'A hash is a fixed-length fingerprint. The same input always gives the same hash, any change gives a completely different one, and it cannot be reversed. MD5 and SHA-1 are broken; use SHA-256 or better.' }),
    p('A **hash function** takes any input, one word or a whole disk, and produces a short fixed-length **digest**. Four properties make it useful:'),
    list(
      '**Same input, same hash**, every time, on any computer.',
      '**Fixed length**: SHA-256 always gives 256 bits (64 hexadecimal characters), whatever you feed it.',
      '**One way**: there is no key and no "unhash". You cannot get the input back from the digest.',
      '**Avalanche**: change one character and about half the bits of the digest flip, so nearly every character you see changes and similar inputs give unrelated hashes.',
    ),
    p('Change the text below and watch. Then try making both messages identical.'),
    hashLab('digest'),
    p('Hashes check **integrity**: a website lists the hash of its installer, you hash your download and compare. Forensic investigators hash a disk image when they make it and again later to prove it was not altered. A **collision** is two different inputs with the same hash; finding one on purpose breaks the algorithm, because an attacker could then swap a document for a different one with the same fingerprint.'),
    table(
      ['Algorithm', 'Digest size', 'Status'],
      [
        ['MD5', '128 bits', 'Broken: collisions are easy. Fine only as a quick non-security checksum'],
        ['SHA-1', '160 bits', 'Broken: a real collision was produced in 2017'],
        ['SHA-256, SHA-512 (the SHA-2 family)', '256 or 512 bits', 'Use these'],
        ['SHA-3', 'Several sizes', 'Use it: a newer design, not a fix for SHA-2'],
        ['RIPEMD-160', '160 bits', 'Older, seen in some cryptocurrencies'],
      ],
    ),
    tip('A **blockchain** is built from hashes: each block stores the hash of the block before it, so changing an old entry would change every hash after it. When copies of the chain are kept by many people in the open, it is called an **open public ledger**.'),

    h('Storing passwords: salting and key stretching', { keep: 'Store passwords as salted, stretched hashes. A unique random salt per user defeats rainbow tables; key stretching (bcrypt, PBKDF2) makes every guess slow.' }),
    p('A website should never store your password, only its hash. At sign-in it hashes what you typed and compares. If the database is stolen, the attacker gets hashes, not passwords. But plain hashes have two problems:'),
    list(
      'Everyone with the same password gets the **same hash**, so cracking one cracks them all.',
      'Attackers precompute the hashes of millions of common passwords into a lookup table, called a **rainbow table**. Matching a stolen hash against it takes moments.',
    ),
    p('A **salt** fixes both. It is a random value made for each user when they set a password. The site hashes salt plus password and stores the salt in the clear next to the hash. The salt is not secret; it just makes every user\'s hash unique, so precomputed tables are useless. Tick the box to add salts:'),
    hashLab('salt'),
    p('**Key stretching** fixes the last problem: hashes are fast, so an attacker with a graphics card can still try billions of guesses a second. Stretching runs the hash thousands of times (or uses a deliberately slow, memory-hungry function) so each guess takes a noticeable fraction of a second. The names to know are **bcrypt**, **PBKDF2**, **scrypt** and **Argon2**.'),
    exam('If a question mentions **rainbow tables**, the answer is **salting**. If it mentions **brute force** or **GPU cracking** of a stolen password file, the answer is **key stretching** (bcrypt, PBKDF2).'),

    h('Digital signatures: proving who sent it', { keep: 'To sign, hash the message and encrypt the hash with your own private key. Anyone verifies with your public key. Only you could have signed it: non-repudiation. A signature does not hide the message.' }),
    p('A digital signature combines hashing and asymmetric keys, but uses the keys the other way round. Here is what happens when Alice signs a contract:'),
    steps(
      'Alice hashes the contract.',
      'She encrypts that hash with **her own private key**. The result is the signature, attached to the contract.',
      'Bob decrypts the signature with **Alice\'s public key**, which gives him the hash Alice made.',
      'Bob hashes the contract he received himself. If the two hashes match, the contract is unchanged **and** it came from Alice.',
    ),
    p('Because only Alice holds her private key, she cannot later claim someone else signed it. That is **non-repudiation**. Note that a signature does **not** hide anything: the contract is still readable. For secrecy too, Alice signs it and then encrypts it for Bob. Work out the keys:'),
    keys('Which key? Signing and both together', [
      { goal: 'Alice signs a contract so Bob can prove Alice agreed to it.', verbs: ['Sign with', 'Verify with'], answer: ['alice-private', 'alice-public'], why: 'Only Alice has her private key, so only she can make the signature. Anyone with her public key can check it.' },
      { goal: 'Bob signs a software update so Alice can check that it really came from Bob.', verbs: ['Sign with', 'Verify with'], answer: ['bob-private', 'bob-public'], why: 'The signer always uses **their own private key**, and everyone else verifies with the signer\'s public key.' },
      { goal: 'Alice sends Bob a message that only Bob can read and that proves it came from Alice.', verbs: ['Sign with', 'Encrypt with'], answer: ['alice-private', 'bob-public'], why: 'She signs with her own private key (proof it is her) and encrypts with Bob\'s public key (only he can read it).' },
      { goal: 'Bob receives that message. How does he open it and check it?', verbs: ['Decrypt with', 'Verify with'], answer: ['bob-private', 'alice-public'], why: 'Bob\'s private key opens what was locked with his public key, and Alice\'s public key checks the signature her private key made.' },
    ], 'The rule: whoever must be the only one able to do something uses their own private key. Signing must be only Alice; reading must be only Bob.'),
    p('An **HMAC** (hash-based message authentication code) is a lighter alternative when both sides already share a secret key: the sender hashes the message mixed with the key, and the receiver does the same and compares. It proves the message is unchanged and came from someone who knows the key, but it gives **no non-repudiation**, because both sides hold the same key and either could have made it.'),

    h('Putting it together: hybrid encryption in TLS', { keep: 'Real systems combine both: asymmetric cryptography to agree on a fresh symmetric session key, then fast symmetric encryption for the data. New keys every session give perfect forward secrecy.' }),
    p('Asymmetric encryption solves key distribution but is slow; symmetric encryption is fast but needs a shared key. **Hybrid encryption** uses each for what it is good at. TLS, which protects HTTPS, is the example to know. Step through a connection:'),
    {
      type: 'sequence',
      title: 'A TLS 1.3 connection, simplified',
      steps: [
        { from: 'Browser', to: 'Server', label: 'Client hello', note: 'The browser lists the **cipher suites** it supports (sets of algorithms, such as ECDHE for key exchange, AES-256-GCM for the data and SHA-384 for hashing) and sends its half of a **Diffie-Hellman key exchange**: a freshly made, one-time public value.' },
        { from: 'Server', to: 'Browser', label: 'Server hello + certificate', note: 'The server picks a cipher suite, sends its own one-time Diffie-Hellman value, and sends its **certificate**: its long-term public key, vouched for by a certificate authority (the next topic). It also **signs** the handshake with its private key, proving it really owns that certificate.' },
        { from: 'Browser', to: 'Server', label: 'Finished', note: 'Each side combines its own one-time secret with the other side\'s public value and arrives at the **same shared secret**. It never crossed the network, so an eavesdropper who saw both public values still cannot compute it. From it, both derive the symmetric **session keys**, and each sends a Finished message encrypted with them to prove it got the same result.' },
        { from: 'Browser', to: 'Server', label: 'Encrypted data (AES-GCM)', note: 'From here on, every request and response is encrypted with fast **symmetric** encryption using the session keys. GCM also checks integrity, so tampering is detected.' },
        { from: 'Server', to: 'Browser', label: 'Connection closes', note: 'The session keys are thrown away. Because they came from **ephemeral** (one-time) Diffie-Hellman values, even someone who later steals the server\'s private key cannot decrypt recordings of this session. That is **perfect forward secrecy**.' },
      ],
    },
    analogy('Diffie-Hellman is like **mixing paint**. Alice and Bob agree in public on a common colour. Each adds a secret colour of their own and sends the mix across. Each then adds their secret colour to the mix they received, and both end up with the same final colour. An onlooker saw both mixes, but cannot unmix paint to find the secrets.'),
    exam('**DHE** and **ECDHE** (the extra E is for "ephemeral") are what give **perfect forward secrecy (PFS)**. Older TLS that sent the session key encrypted with the server\'s RSA key had no PFS: steal that one key and every recorded session opens.'),

    h('Practice: which tool for the job?', { keep: 'Ask what the job needs: secrecy, proof of no change, proof of who sent it, a check between two key holders, password storage, or a shared key from scratch. Then pick the tool that does that one job.' }),
    pbq('Which tool for the job?', CRYPTO_TOOLS, { intro: 'Seven jobs, seven tools. Each tool is used exactly once.' }),

    h('Where encryption is applied, and hiding data without it', {
      keep: 'Encryption can cover a whole disk, a partition or volume, a file, a database or a single record, or data on the move. Tokenization, masking and steganography hide data without encrypting it.',
      optional: 'This is a list of names to recognize rather than an idea to understand. Your course covers it, and the flashcards drill it.',
    }),
    table(
      ['Level', 'What it protects', 'Example'],
      [
        ['Full-disk (FDE)', 'Everything on the drive, if the device is lost or stolen while off', 'BitLocker, FileVault, self-encrypting drives'],
        ['Partition or volume', 'One part of a drive', 'An encrypted data volume on a server'],
        ['File', 'Individual files, wherever they are copied', 'EFS on Windows, an encrypted ZIP'],
        ['Database', 'The whole database at rest', 'Transparent data encryption'],
        ['Record (or column)', 'Only the sensitive fields, such as card numbers', 'Column-level encryption'],
        ['Transport', 'Data while it travels', 'TLS, IPsec, SSH'],
      ],
      { caption: 'Encryption levels' },
    ),
    table(
      ['Technique', 'What it does', 'Example'],
      [
        ['Tokenization', 'Swaps the real value for a meaningless token; the real value lives only in a secure vault', 'A shop stores tok_83hd instead of the card number'],
        ['Data masking', 'Hides part of a value when it is displayed or copied', 'Card ending ****-****-****-4242'],
        ['Steganography', 'Hides data inside other data so nobody knows it is there', 'A message hidden in the pixels of a photo'],
      ],
      { caption: 'Obfuscation: hiding without encrypting' },
    ),

    h('Practice: protect data in each state', { keep: 'Data at rest gets disk, database or file encryption; data in transit gets TLS or IPsec; keys belong in a key management service or HSM, never next to the data they protect.' }),
    examPbqs('crypto', 'These come from the practice exam: close the gaps for data at rest, in transit and in use, and configure encrypted cloud storage with managed keys. They load when you press Start.'),
  ],
  check: [
    mcq('Bob wants to send Alice a confidential message using asymmetric encryption. Which key should he encrypt it with?',
      'Alice\'s public key', ['Alice\'s private key', 'Bob\'s private key', 'Bob\'s public key'],
      'To keep something secret for Alice, lock it with her public key: only her private key can open it. Bob\'s own keys play no part in keeping it secret.'),
    mcq('A company must prove that a particular manager approved a purchase order and that it was not changed afterwards. What should the manager use?',
      'A digital signature made with the manager\'s private key',
      ['A SHA-256 hash stored next to the purchase order', 'Encryption with the manager\'s public key', 'AES encryption with a key shared with finance'],
      'A signature proves integrity and who signed, with non-repudiation. A hash alone proves no change but not who made it (anyone can hash), and encryption hides the order without proving anything about the sender.'),
    mcq('A stolen password database shows different stored values for two users who chose the same password. What most likely explains this?',
      'Each password was hashed with its own random salt',
      ['The passwords were hashed with SHA-256 instead of MD5', 'The site uses key stretching', 'The passwords were encoded with Base64'],
      'Only a per-user salt makes identical passwords hash differently. Key stretching alone slows guessing but the same password still gives the same result, and the choice of hash algorithm does not change that.'),
    mcq('Why does TLS use asymmetric cryptography only at the start of a connection?',
      'It is slow, so it is used to agree on a symmetric session key that then encrypts the data',
      ['Asymmetric keys expire as soon as the handshake ends', 'Symmetric encryption is more secure than asymmetric encryption', 'Asymmetric encryption cannot encrypt web pages'],
      'This is hybrid encryption: asymmetric cryptography (key exchange and a signature) sets up a shared session key, and fast symmetric encryption such as AES-GCM carries the data.'),
  ],
};
