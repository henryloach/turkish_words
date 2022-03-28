<script>
    // import WordStore from '../stores/WordStore.js';
    import Card from '../shared/Card.svelte';
    import TargetSentence from './TargetSentence.svelte'


    ////////// For word object bundled with site //////////

    // import words from '../stores/words.js'; 
    // $: wordObj = words.find((word) => word.id == activeId); 

    ///////////////////////////////////////////////////////

    
    ///////////////////////////////////
    ///// Code for REST API setup /////
    ///////////////////////////////////

    let wordObj = {
        "id": 1,
        "turkish_word": "ve",
        "english_word": "and",
        "type": "conj",
        "turkish_sentence": "Ankara ve İstanbul Türkiye’nin büyük şehirlerindendir.",
        "english_sentence": "Ankara and Istanbul are some of Turkey’s larger cities."
    }

    $: url = `http://localhost:3060/words/${activeId}`

    $: {
        fetch(url)
        .then(res => res.json())
        .then(data => { wordObj = data; })
    }
    
    ///////////////////////////////////////////////////




    //////////// Spaced Repetition Logic //////////////

    const range = (s, e) => e > s ? [s, ...range(s + 1, e)] : [s];

    let bins = initBins()

    function createSet(bins) {
        let set = []
        bins.forEach(bin => bin.forEach(item => {
            if ( (Math.random() > 0.8) && (set.length <= 40) ) {
                set = [...set, item] 
            } 
        }))
        return set;
    }

    function initBins() {
        let bins = [];
        for (let i = 0; i < 100; i++) {
            bins[i] = range(i*20 + 1, i*20 + 20)
        } 
        return bins;
    }   

    function find(bins, item) {
        return bins.map(bin => bin.includes(item)).indexOf(true);
    }

    function remove(bins, item) {
        return bins.map(bin => bin.filter((x) => x != item))
    }

    function add(bins, targetIndex, item) {
        return bins.map((bin, binIndex) => {
            if (binIndex == targetIndex) return [...bin, item];
            else return bin;
        });    
    }

    function promote(bins, item) {
        const currentBin = find(bins, item)
        if ( currentBin != 99 ) {
            bins = remove(bins, item);
            bins = add(bins, currentBin + 1, item);
        }
        return bins;
    }

    function demote(bins, item) {
        const currentBin = find(bins, item)
        if ( currentBin != 0 ) {
            bins = remove(bins, item);
            bins = add(bins, currentBin + -1, item);
        }
        return bins;
    }


    //////////////////////////////////////////////////


    let set = createSet(bins);

    console.log(set)

    let activeId = 1;
    activeId = set.shift(); // <-----------DEBUG
    console.log(activeId);

    function handleSuccess() {
        activeId = set.shift();
    }

</script>

    <Card>
    <p class="target-sentence"><TargetSentence {wordObj} on:sucess={handleSuccess}/><span class="correct-tick"></span></p>
    <p class="word-type">{wordObj.type}</p>
    <hr>
    <p class="source-word">{wordObj.english_word} </p>
    <p class="source-sentence">{wordObj.english_sentence}</p>
    {#if wordObj.notes}
    <p class="notes">notes: <br> {wordObj.notes}</p>
    {/if}
    <button class="previous-button" on:click={() => activeId = (activeId - 1 < 1) ? 1 : activeId -1}>Previous</button>
    <button class="next-button" on:click={() => activeId = (activeId + 1 > 2000) ? 2000 : activeId + 1}>Next</button>
    <p>debug------{wordObj.id} {wordObj.turkish_word}</p>
    </Card> 

    <style>
        p {
            font-size: 20px;
            margin: 0;
        }

        .target-sentence {
            font-size: 25px;
        }

        .correct-tick {
            color: beige;
        }

        .word-type {
            padding: 20px 0px;
            font-style: italic;
        }

        .source-word {
            font-size: 30px;
            padding-top: 20px;
            padding-bottom: 0px;
        }

        .source-sentence {
            padding-top: 10px;
            padding-bottom: 20px;
        }

        .notes {
            padding: 15px 0px;
            font-size: 18px;
        }

        button {
            color: gray;
            font-weight: 600;
            border-radius: 5rem;
            padding: 10px 20px;
            border: 4px solid darkgray; 
            background-color: white;
            margin: 0;
        }

        button:focus,
        button:hover {
            cursor: pointer;
            border-color: steelblue;
            color: steelblue;
        }

        .next-button {
            margin-left: 20px;
           
        }

        .previous-button {
            margin-right: 20px;
        }

        

    </style>

