var ghpages = require('gh-pages');

ghpages.publish(
    'public', // path to public directory
    {
        branch: 'main',
        repo: 'https://github.com/hneryloach/turkish_words.git', // Update to point to your repository  
        user: {
            name: 'Your name', // update to use your name
            email: 'Your Email address' // Update to use your email
        }
    },
    () => {
        console.log('Deploy Complete!')
    }
)