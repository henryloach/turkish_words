<script>
import { createEventDispatcher } from 'svelte';
const dispatch = createEventDispatcher();

export let is_shift;

const characterList = ['ç', 'ğ', 'ı', 'i', 'ö', 'ş', 'ü'];
const characterMap = Object.assign({}, characterList);

const handleClick = function(character) {
    if (is_shift) {
        document.querySelector(".text-input").value += character.toUpperCase();
    } else {
        document.querySelector(".text-input").value += character;
    }
}

const handleKeyDown = function(event) {
    console.log(event.key);
    if (event.key === 'Backspace' || event.key === 'Delete') {
        const currentString = document.querySelector(".text-input").value
        const newString = currentString.slice(0,-1);
        document.querySelector(".text-input").value = newString;
    }
}

</script>

{#each characterList as character}
    {#if is_shift}
        <button on:keydown={handleKeyDown} on:click={() => handleClick(character)}>{character.toUpperCase()}</button>
    {:else}
        <button on:keydown={handleKeyDown} on:mousedown|preventDefault on:click={() => handleClick(character)}>{character}</button>
    {/if}
{/each}

<style>
button {
        color: grey;
        font-size: 25px;
        border-radius: 5rem;
        border: 3px solid darkgrey;
        padding: 5px 20px;
        margin: 20px 5px;
        background-color: white;
    }

button:hover {
    cursor: pointer;
}

button:focus {
    border-color: steelblue;
    color: steelblue;
}

</style>

<!-- array.keys() -->