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
        if (word.toLowerCase() === answer.toLowerCase()) {
            document.querySelector(".correct-tick").innerHTML = "&#x2714;";
            document.querySelector(".text-input").style.color = "green";
            document.querySelector(".correct-tick").style.color = "green";
            solved = true; 
            hint = ""; 
            hintStage = 0;

            setTimeout(() => {
                document.querySelector(".correct-tick").innerHTML = "";
                dispatch('sucess');
            }, 1000);
            
        } else {
            document.querySelector(".correct-tick").innerHTML = "&#x2716;";
            document.querySelector(".correct-tick").style.color = "darkred";
            document.querySelector(".text-input").style.color = "darkred";

            setTimeout(() => {
                document.querySelector(".correct-tick").innerHTML = "";
                document.querySelector(".text-input").style.color = "#333";
                hint = word.slice(0,++hintStage);
                answer = ""
            }, 250);
            
            
        }      
    }     
}

const canvas = document.createElement('canvas');
const ctx = canvas.getContext("2d");
ctx.font = "25px Helvetica";
$: textWidth = 1 + Math.ceil(ctx.measureText(word).width);

function handleLoad() {
    const inputs = document.querySelectorAll(".text-input")
    inputs.forEach((input) => {input.style.width = textWidth + "px";});
}

afterUpdate(handleLoad);

</script>


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


<style>
    input {
        border: none;
        background-color: #d6dce9;
        width:var(--inputWidth);
        padding: 0;
        color: #333;
    }

    input:focus {
        outline: none;
        border-bottom: 2px solid steelblue;
    }

    input::placeholder{
        color: steelblue;
    }  
</style>