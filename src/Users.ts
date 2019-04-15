import {Snowflake} from "discord.js";

abstract class User {
    public static id: Snowflake
}

class Brigie extends User {
    public static id = "189195422114381824";
}
class Eitri extends User {
     public static id = "106004012347695104";
}
class Hally extends User {
     public static id = "158533023736791041";
}
class Kraysan extends User {
     public static id = "177926353373364224";
}
class Nym extends User {
     public static id = "98075883549519872";
}
class Oni extends User {
     public static id = "181267070111973376";
}
class Rex extends User {
     public static id = "159868064228179968";
}
class Ryk extends User {
     public static id = "136276996261937152";
}
class Sasner extends User {
     public static id = "107435240686931968";
}
class Sassybot extends User {
     public static id = "402131531268882432";
}
class Uriko extends User {
     public static id = "157324426076094474";
}
class Verian extends User {
     public static id = "159756239016820736";
}
class Yoake extends User {
     public static id = "215882287693299713";
}
class Lev extends User {
     public static id = "124854733096615937";
}
class Vera extends User {
     public static id = "210082031282028554";
}
class Sastra extends User {
     public static id = "293238959449047041";
}
class Pas extends User {
     public static id = "85871040374259712";
}

export default {
    Brigie,
    Eitri,
    Hally,
    Kraysan,
    Nym,
    Oni,
    Rex,
    Ryk,
    Sasner,
    Sassybot,
    Uriko,
    Verian,
    Yoake,
    Lev,
    Vera,
    Sastra,
    Pas
}