<script>
    // import WordStore from '../stores/WordStore.js';
    import words from '../stores/words.js';
    
    import Card from '../shared/Card.svelte';
    import TargetSentence from './TargetSentence.svelte'

    let activeId = 1;
    
    $: wordObj = words.find((word) => word.id == activeId);

    function handleSuccess() {
        activeId++;
    }

</script>
    <p>English Word: {wordObj.english_word} </p>
    <TargetSentence {wordObj} on:sucess={handleSuccess}/>
    <p>English Sentence: {wordObj.english_sentence}</p>
    <p>{wordObj.type} {wordObj.notes || ""}</p>
    <button on:click={() => activeId = (activeId - 1 < 1) ? 1 : activeId -1}>Next</button>
    <button on:click={() => activeId = (activeId + 1 > words.length) ? words.length : activeId + 1}>Next</button>

    <style>
        p {
            font-size: 20px;
        }
    </style>

