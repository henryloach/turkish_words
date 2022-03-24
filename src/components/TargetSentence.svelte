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

// This is also horrible. Also one of these İİ's is one of those two char thing 
const re = /[\w'ÇĞIİİÖŞÜçğıi̇öşü]+|\s+|[^\s\w]+/gu

$: spanList = sentence.match(re);

// refactor
function handleSubmit(event) {
    const inputs = document.querySelectorAll(".text-input")
    if (event.key === 'Enter') {
        if (word.toLowerCase() === answer.toLowerCase()) {     
            inputs.forEach((input) => {
                input.innerHTML = "&#x2714;"; 
                input.style.color = "green";
                input.style.color = "green";
                input.style.backgroundColor = "white";
            });
            solved = true; 
            hint = ""; 
            hintStage = 0;

            setTimeout(() => {
                document.querySelector(".correct-tick").innerHTML = "";
                document.querySelector(".text-input").style.backgroundColor = "#e9ebf1";
                dispatch('sucess');
            }, 1000);
            
        } else {
            inputs.forEach((input) => {
                input.innerHTML = "&#x2716;";
                input.style.color = "darkred";
                input.style.color = "darkred";
                input.style.backgroundColor = "white";
            });

            setTimeout(() => {
                document.querySelector(".correct-tick").innerHTML = "";
                document.querySelector(".text-input").style.color = "#333";
                document.querySelector(".text-input").style.backgroundColor = "#e9ebf1";
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
        background-color: #e9ebf1;
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