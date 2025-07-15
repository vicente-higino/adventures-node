import { pickRandom } from "../utils/misc";
import { Adventure } from "./index";

export const customAdventures: Adventure[] = [
    {
        description: () =>
            `Friends! I've got coordinates for a secret stash of bolts, hidden away within the bowels of the elven forest. We should shoe up and give this a go!`,
        winMessages: [name => ``],
        loseMessages: [name => ``],
        endWin: names => (names ? `Dayum, that was a close call for losing a leg. But you've deserved this ${names}!` : ""),
        endLose: names => (names ? `Look out, bear traps! ${names} got their legs ripped off!` : ""),
    },
    {
        description: () =>
            `I think we have a much bigger threat on our hands than the cave in... It is half man, half bear, half pig... Don't Laugh, I'M SUPER CEREAL! As the adventurers work their way through the tunnels they hear a soft noise from behind them...`,
        winMessages: [name => `${name} run away.`],
        loseMessages: [name => ``],
        endWin: names => (names ? `Let's get out of here guys! We can't deal with this alone.` : ""),
        endLose: names => (names ? `Look out! It's ManBearPig! ${names} get dragged off into the darkness.` : ""),
    },
    {
        description: () =>
            `Your memory is vague, on the table a small laptop is playing a video: "My name is The Architect. The bank of Karabraxos is the most secure bank in the universe. You will rob the bank of Karabraxos!"`,
        winMessages: [name => ``],
        loseMessages: [name => ``],
        endWin: names =>
            names
                ? `We find ourselves back in the room we started in as consciousness of ${names} slowly fades again, only to wake up in our beds like nothing at all has happened.`
                : "",
        endLose: names =>
            names ? `Unable to leave their minds blank, ${names} slowly feel their mind being drained as The Teller feeds on their thoughts.` : "",
    },
    {
        description: () =>
            `The smell of pepperoni and melting cheese fills the air. ${pickRandom(["pizzaSpin"])} You stand before "Offslie's Pizzaria", famed for its legendary Golden Slice. Rumor has it, it grants eternal pizza bliss. But beware, the animatronic band is notoriously aggressive after hours!`,
        winMessages: [name => ``],
        loseMessages: [name => ""],
        endWin: names => (names ? `Success! ${names} secures the Golden Slice! The taste is... indescribable! You've achieved pizza nirvana!` : ""),
        endLose: names =>
            names ? `Oh no! ${names} couldn't handle the heat and got tossed out like yesterday's crusts! No Golden Slice today.` : "",
    },
    {
        description: () =>
            `You awaken in a cold, metallic room. A voice booms, "Welcome, contestants, to the Galactic Gameshow! Your challenge: survive the obstacle course of doom!"`,
        winMessages: [name => ``],
        loseMessages: [name => ``],
        endWin: names =>
            names
                ? `Congratulations, ${names}! You've conquered the Galactic Gameshow and won the grand prize: a lifetime supply of space snacks!`
                : "",
        endLose: names => (names ? `Alas, ${names} couldn't survive the gameshow. Better luck in the next dimension!` : ""),
    },
    {
        description: () =>
            `The air crackles with magic. You stand before the Grand Library of Eldoria, rumored to contain spells of unimaginable power. But beware, the library is guarded by arcane constructs and mischievous imps!`,
        winMessages: [name => ``],
        loseMessages: [name => ``],
        endWin: names => (names ? `Huzzah, ${names}! You've mastered the Grand Library and gained untold magical knowledge!` : ""),
        endLose: names => (names ? `Tragedy strikes! ${names} couldn't navigate the library's dangers and is lost forever!` : ""),
    },
    {
        description: () =>
            `A dense fog rolls in. You find yourselves in the heart of the Carnival of Lost Souls, a place where dreams and nightmares intertwine. The ringmaster beckons, "Step right up, adventurers, and test your fate!"`,
        winMessages: [name => ``],
        loseMessages: [name => ``],
        endWin: names => (names ? `Bravo, ${names}! You've survived the Carnival of Lost Souls and escaped with your sanity intact!` : ""),
        endLose: names => (names ? `Alas, ${names} couldn't escape the carnival's clutches and is doomed to wander its twisted paths forever!` : ""),
    },
    {
        description: () => `You stumble upon an ancient portal pulsating with energy. Do you dare to step through and face the unknown?`,
        winMessages: [name => ``],
        loseMessages: [name => ``],
        endWin: names => (names ? `With a final surge of power, ${names} close the portal, preventing further incursions.` : ""),
        endLose: names => (names ? `The portal overwhelms ${names}, scattering them across time and space.` : ""),
    },
    {
        description: () => `A mysterious signal leads you to a derelict spaceship drifting in the void. What secrets does it hold?`,
        winMessages: [name => ``],
        loseMessages: [name => ``],
        endWin: names => (names ? `${names} successfully repair the ship and set a course for home.` : ""),
        endLose: names => (names ? `${names} trigger the ship's automated defenses and are vaporized instantly.` : ""),
    },
    {
        description: () => `You find yourselves in a bustling goblin market. Can you haggle your way to a valuable treasure?`,
        winMessages: [name => ``],
        loseMessages: [name => ``],
        endWin: names => (names ? `${names} strike a bargain and acquire a legendary artifact.` : ""),
        endLose: names => (names ? `The goblins swindle ${names}, leaving them penniless and humiliated.` : ""),
    },
];
