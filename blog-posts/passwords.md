---
title: Passwords Over the Years and How to Keep Them Safe
slug: passwords
date: 2025-02-16 12:00
description: A short history of passwords, hashing, MFA, and practical password security habits.
---

# Passwords Over the Years and How to Keep Them Safe

We all know passwords are the basic measure we all have to use in order to keep our stuff safe. We use them on a daily basis, nearly hourly. We use them on websites or apps; sometimes physically, with padlocks or safes. They have been the first step to online security since computers were a thing.

We consider Fernando Corbato the father of modern passwords as we know them. He introduced passwords to the field of computer science in the 60s at MIT, where he used them to manage privacy among a large database. As time went on, passwords became insecure, requiring an update. In the 70s, Robert Morris Sr. devised what we call hashing, a method to represent a password without actually containing it.

Hashing is what we use today on nearly every modern computer to prevent passwords from leaking when security breaks. One way to describe hashing is the following: when someone logs into a system, the system hashes the password the user provides and compares it to an already existing hash of the correct password. If the two hashes match, the system understands that the user provided a valid password. If the hashes do not match, then the password is invalid.

Hashes are incredibly useful because they do not contain the passwords within themselves, making "de-hashing" impossible. Later, in 1979, Morris and Ken Thompson introduced random data to hashed passwords in order to complicate the potential hacking of hashed passwords, a process called salting.

Finally, in the late 2000s and early 2010s, passwords became so trivial that we needed to further improve security. The introduction of MFA, multi-factor authentication, increased the efficiency of online security and brought the world more ways to authenticate into locked systems. MFA methods can vary from fingerprint scanners, SMS code confirmations, security questions, and even retinal scans. StrongDM separates MFA methods into categories: something you have, something you know, and something you are.

To make sure passwords are secure, we use many different rules of thumb. To make a password more secure:

- Keep your passwords long.
- Add different characters.
- Do not reuse them on different websites.

Here are some things to never do, under any circumstances:

- Put all your passwords in one place, like a PDF or a piece of paper.
- Reuse your passwords on multiple accounts.
- Share your passwords or accounts with others.

We are all human, so do not make your passwords so complicated you will not remember them. I recommend using a password manager to generate, store, and organize your passwords properly. I personally recommend 1Password. One final suggestion is to regularly change your passwords. This does seem like overkill, but it is a foolproof way to protect your accounts.

As time goes by, our security measures become more and more secure, but so does cracking. Some of the most commonly used password cracking methods are brute-force attacks, where a computer attempts to log in to a system by trying every possible password. This is exactly why we need to make our passwords long, complex, and unpredictable.

## Sources

- [WeLiveSecurity: a short history of computer passwords](https://www.welivesecurity.com/2017/05/04/short-history-computer-password/)
- [Britannica: password computing](https://www.britannica.com/technology/password-computing)
- [StrongDM: multi-factor authentication types](https://www.strongdm.com/blog/multi-factor-authentication-types)
- [Wired: password security guidance](https://www.wired.com/story/7-steps-to-password-perfection/)
