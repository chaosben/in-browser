# Encrypted folder for `gocryptfs.spec.ts`

`v1.3/` is the example file system of the same name from gocryptfs' own tests
(`tests/example_filesystems/v1.3` in https://github.com/rfjakob/gocryptfs, MIT License, © 2015 Jakob Unterwurzacher),
without its two symbolic links. Password `test`, master key
`fd890dab-86bf61cf-ec5ad460-ad3ed01f-9c52d546-2a31783d-a56b088d-3d05232e`. It holds `status.txt` (“It works!\n”)
and a file with a name of 255 bytes (`longname_255_xxx…`, stored as a long name). Test data only, not shipped.

# AES-SIV cases for `siv.spec.ts`

`siv-testcases.txt` is a selection (the cases with 256-bit keys, up to ten per count of associated data) of
`src/test/resources/testcases.txt` of Cryptomator's siv-mode (https://github.com/cryptomator/siv-mode, MIT License,
© 2015-2017 Cryptomator). One case per line: `ctrKey;macKey;plaintext;n;ad1;…;adn;ciphertext` in hex.
