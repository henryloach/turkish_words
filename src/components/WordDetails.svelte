<script>
    // import WordStore from '../stores/WordStore.js';
    import words from '../stores/words.js';
    
    import Card from '../shared/Card.svelte';
    import TargetSentence from './TargetSentence.svelte'

    let activeId = 1;
    activeId = 20; // <-----------DEBUG
    
    $: wordObj = words.find((word) => word.id == activeId);

    function handleSuccess() {
        activeId++;
    }

</script>

    <Card>
    <p class="target-sentence"><TargetSentence {wordObj} on:sucess={handleSuccess}/>&#9;<span class="correct-tick"></span></p>
    <p class="word-type">{wordObj.type}</p>
    <hr>
    <p class="source-word">{wordObj.english_word} </p>
    <p class="source-sentence">{wordObj.english_sentence}</p>
    {#if wordObj.notes}
    <p class="notes">notes: <br> {wordObj.notes}</p>
    {/if}
    <button class="previous-button" on:click={() => activeId = (activeId - 1 < 1) ? 1 : activeId -1}>Previous</button>
    <button class="next-button" on:click={() => activeId = (activeId + 1 > words.length) ? words.length : activeId + 1}>Next</button>
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

