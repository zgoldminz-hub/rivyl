import axios from "axios";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const QB = ["Josh Allen","Lamar Jackson","Drake Maye","Jalen Hurts","Joe Burrow","Jayden Daniels","Dak Prescott","Patrick Mahomes","Jaxson Dart","Caleb Williams","Trevor Lawrence","Brock Purdy","Justin Herbert","Jordan Love","Matthew Stafford","Sam Darnold","Kyler Murray","Jared Goff","Bo Nix","Tyler Shough","Baker Mayfield","C.J. Stroud","Cam Ward","Daniel Jones","Bryce Young","Aaron Rodgers","Jacoby Brissett","Malik Willis","Fernando Mendoza","Geno Smith","Shedeur Sanders","Tua Tagovailoa","Michael Penix Jr."];

const RB = ["Jahmyr Gibbs","Bijan Robinson","De'Von Achane","Christian McCaffrey","Jonathan Taylor","Saquon Barkley","James Cook","Ashton Jeanty","Kenneth Walker","Josh Jacobs","Derrick Henry","Chase Brown","Omarion Hampton","Travis Etienne","Jeremiah Love","Breece Hall","Bhayshul Tuten","Cam Skattebo","Kyren Williams","Quinshon Judkins","David Montgomery","Jadarian Price","D'Andre Swift","TreVeyon Henderson","J.K. Dobbins","Bucky Irving","RJ Harvey","Jaylen Warren","Tony Pollard","Chuba Hubbard","Rhamondre Stevenson","Aaron Jones","Rico Dowdle","Jordan Mason","Blake Corum","Kenneth Gainwell","Woody Marks","Kyle Monangai","Jonathan Brooks"];

const WR = ["Ja'Marr Chase","Puka Nacua","Jaxon Smith-Njigba","Justin Jefferson","Amon-Ra St. Brown","CeeDee Lamb","A.J. Brown","Drake London","Rashee Rice","Nico Collins","Malik Nabers","George Pickens","DeVonta Smith","Chris Olave","Davante Adams","Zay Flowers","Terry McLaurin","Garrett Wilson","Mike Evans","Carnell Tate","Tee Higgins","Tetairoa McMillan","DJ Moore","Alec Pierce","Jaylen Waddle","Jameson Williams","DK Metcalf","Marvin Harrison Jr.","Brian Thomas Jr.","Matthew Golden","Emeka Egbuka","Rome Odunze","Courtland Sutton","Jerry Jeudy","Tre Tucker","Ladd McConkey","Chris Godwin","Makai Lemon","Jordan Tyson","Michael Wilson","Michael Pittman Jr.","Jordan Addison","KC Concepcion","Quentin Johnston","Wan'Dale Robinson"];

const TE = ["Brock Bowers","Trey McBride","Tyler Warren","Colston Loveland","Tucker Kraft","Sam LaPorta","Dallas Goedert","George Kittle","Harold Fannin Jr.","Travis Kelce","Jake Ferguson","Isaiah Likely","Mark Andrews","Hunter Henry","Brenton Strange","T.J. Hockenson","Juwan Johnson","AJ Barner","Dalton Kincaid","Dalton Schultz"];

async function seed() {
  await prisma.playerRanking.deleteMany({});
  console.log("Cleared old rankings");

  const res = await axios.get("http://localhost:4000/players?limit=600");
  const players: any[] = res.data.data.players;
  const byName = new Map(players.map((p: any) => [p.name.toLowerCase(), p]));

  const groups = [
    { pos: "QB", list: QB },
    { pos: "RB", list: RB },
    { pos: "WR", list: WR },
    { pos: "TE", list: TE },
  ];

  let total = 0;
  const notFound: string[] = [];

  for (const { pos, list } of groups) {
    const seen = new Set<string>();
    let rank = 1;
    for (const name of list) {
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const p = byName.get(key);
      if (!p) { notFound.push(`${pos}: ${name}`); continue; }
      await prisma.playerRanking.create({
        data: { playerId: p.id, rank, notes: pos },
      });
      rank++;
      total++;
    }
    console.log(`${pos}: seeded ${rank - 1} players`);
  }

  if (notFound.length) {
    console.log("\nNot found:");
    notFound.forEach(n => console.log(" -", n));
  }
  console.log(`\nTotal: ${total} rankings seeded`);
  await prisma.$disconnect();
}

seed().catch(e => { console.error(e); process.exit(1); });
