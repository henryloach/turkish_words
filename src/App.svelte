<script>
	import Header from './components/Header.svelte';
	import WordDetails from './components/WordDetails.svelte';
	import CharacterButtons from './components/CharacterButtons.svelte';

	let is_shift = false;

	const handleKeydown = (event) => {
		if (event.key === 'Shift') is_shift = true;		
	}

	const handleKeyUp = (event) => {
		if (event.key === 'Shift') is_shift = false;	
	}

</script>

<Header/>
<main on:keyup={handleKeyUp} on:keydown ={handleKeydown}>
	<WordDetails/>
	<CharacterButtons {is_shift}/>
</main>

<style>
	main {
		text-align: center;
		padding: 1em;
		max-width: 240px;
		margin: 0 auto;
	}

	@media (min-width: 640px) {
		main {
			max-width: none;
		}
	}
</style>