<script>
import { afterUpdate } from 'svelte';
import { createEventDispatcher } from 'svelte';
const dispatch = createEventDispatcher();

export let wordObj;
let answer = "";
let solved = false;
let hint = "";
let hintStage = 0;

$: word = wordObj.turkish_word;
$: sentence = wordObj.turkish_sentence;
$: id = wordObj.id;

// This seems like a hack. Redo properly...
$: {
    id;
    answer="";
}

// This is also horrible.
const re = /[\w'ÇĞIİİÖŞÜçğıi̇öşü]+|\s+|[^\s\w]+/gu

$: spanList = sentence.match(re);

function handleSubmit(event) {
    if (event.key === 'Enter') {
        if (word === answer) {
            solved = true; 
            hint = ""; 
            hintStage = 0;
            dispatch('sucess');
        } else {
            hint = word.slice(0,++hintStage);
            answer = ""
        }      
    }     
}

const canvas = document.createElement('canvas');
const ctx = canvas.getContext("2d");
ctx.font = "20px Helvetica";
$: textWidth = Math.ceil(ctx.measureText(word).width);

function handleLoad() {
    const inputs = document.querySelectorAll(".text-input")
    inputs.forEach((input) => {input.style.width = textWidth + "px";});
}

afterUpdate(handleLoad);

</script>

<p>
    {#each spanList as span}
        {#if span.toLowerCase() === word.toLowerCase()}
            <input 
                class="text-input" 
                type="text" 
                autocomplete="off" 
                autocorrect="off" 
                spellcheck="false" 
                autocapitalize="off" 
                placeholder={hint} 
                autofocus 
                bind:value={answer} 
                on:keypress={handleSubmit}/> 
        {:else}
            <span>{span}</span>
        {/if}
    {/each}
</p>

<style>
    input {
        border: none;
        background-color: #f7f7f7;
        width:var(--inputWidth);
        padding: 0;
    }

    input:focus {
        outline: none;
        border-bottom: 2px solid steelblue;
    }

    input::placeholder{
        color: steelblue;
    }
    
    p {
        font-size: 20px;
    }
</style>