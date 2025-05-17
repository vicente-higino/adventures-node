import { pickRandom } from "../utils/misc";
import { Adventure } from "./index";

export const customAdventures: Adventure[] = [
    {
        description: () =>
            `Friends! I've got coordinates for a secret stash of bolts, hidden away within the bowels of the elven forest. We should shoe up and give this a go!`,
        winMessages: [name => ``],
        loseMessages: [name => ``],
        endWin: names => (names ? `Dayum, that was a close call for losing a leg. But you've deserved this ${names}!` : ""),
        endLose: names => (names ? `Look out, bear traps! ${names} got their legs ripped off! !` : ""),
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
            `The smell of pepperoni and melting cheese fills the air. ${pickRandom(["MakingPizza", "pizzaSpin"])} You stand before "Offslie's Pizzaria", famed for its legendary Golden Slice. Rumor has it, it grants eternal pizza bliss. But beware, the animatronic band is notoriously aggressive after hours!`,
        winMessages: [
            name => `${name} dodges a flying meatball and grabs a slice!`,
            name => `${name} outsmarts the singing sausage animatronic.`,
            name => `${name} distracts the animatronics with a pizza box and sneaks past.`,
            name => `${name} finds a secret passage behind the soda machine and escapes danger.`,
            name => `${name} impresses Chef Alfredo with their pizza knowledge and earns a reward.`,
        ],
        loseMessages: [name => ""],
        // endWin: names =>
        //     names
        //         ? `Success! ${names} secures the Golden Slice! The taste is... indescribable! You've achieved pizza nirvana!`
        //         : "The Golden Slice is secured! Pizza for everyone!",
        endLose: names =>
            names
                ? `Oh no! ${names} couldn't handle the heat and got tossed out like yesterday's crusts! No Golden Slice today.`
                : "The animatronics were too much! The party retreats, defeated and hungry.",
    },
];
