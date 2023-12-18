import React from "react";
import Bubble from './Bubble';

const data = {
    "60": 0,
    "72": 0,
    "14": 3,
    "120": 0,
    "109": 0,
    "88": 0,
    "39": 0,
    "89": 0,
    "37": 0,
    "59": 0,
    "108": 0,
    "96": 0,
    "64": 0,
    "27": 0,
    "42": 0,
    "45": 0,
    "114": 0,
    "77": 0,
    "83": 0,
    "123": 0,
    "31": 1,
    "65": 0,
    "40": 0,
    "18": 1,
    "52": 0,
    "12": 4,
    "115": 0,
    "11": 1,
    "24": 2,
    "76": 0,
    "75": 0,
    "10": 10,
    "21": 2,
    "125": 0,
    "117": 0,
    "56": 0,
    "70": 0,
    "110": 0,
    "73": 0,
    "118": 0,
    "61": 0,
    "23": 1,
    "13": 0,
    "122": 0,
    "66": 0,
    "58": 0,
    "126": 0,
    "119": 0,
    "30": 1,
    "38": 0,
    "71": 0,
    "53": 0,
    "4": 22,
    "43": 0,
    "57": 0,
    "26": 0,
    "79": 0,
    "95": 0,
    "98": 0,
    "106": 0,
    "16": 1,
    "44": 0,
    "87": 0,
    "85": 0,
    "100": 0,
    "7": 3,
    "91": 0,
    "105": 0,
    "35": 1,
    "81": 0,
    "55": 0,
    "1": 590,
    "78": 0,
    "50": 1,
    "8": 3,
    "113": 0,
    "62": 0,
    "36": 1,
    "22": 0,
    "124": 0,
    "47": 0,
    "67": 0,
    "74": 0,
    "25": 0,
    "9": 4,
    "20": 2,
    "86": 0,
    "17": 1,
    "46": 0,
    "102": 0,
    "32": 0,
    "49": 0,
    "112": 0,
    "28": 0,
    "48": 0,
    "19": 0,
    "69": 0,
    "94": 0,
    "2": 234,
    "103": 0,
    "5": 18,
    "41": 0,
    "121": 1,
    "90": 0,
    "107": 0,
    "101": 0,
    "111": 0,
    "15": 3,
    "99": 0,
    "97": 0,
    "3": 72,
    "93": 0,
    "127": 0,
    "6": 15,
    "33": 0,
    "51": 0,
    "63": 0,
    "104": 0,
    "54": 0,
    "116": 0,
    "82": 0,
    "84": 0,
    "92": 0,
    "80": 0,
    "29": 1,
    "34": 0,
    "68": 0
}

export function App() {

	return (
      <Bubble
        primaryColor="#BFD4FE" // Set your desired color here
        secondaryColor="#72A1FD" // Set your desired color here
        collectionName="L'h3ritage"
        data={data}
        width={8}
      />
	);
}

export default App;