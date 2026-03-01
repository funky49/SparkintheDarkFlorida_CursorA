function showPage(pageId) {
    // 1. Hide all sections
    const sections = document.querySelectorAll('.page-section');
    sections.forEach(section => {
        section.classList.remove('active');
    });

    // 2. Remove 'active' styling from all buttons
    const buttons = document.querySelectorAll('nav button');
    buttons.forEach(button => {
        button.classList.remove('active');
    });

    // 3. Show the selected section
    document.getElementById(pageId).classList.add('active');

    // 4. Highlight the clicked button
    document.getElementById('nav-' + pageId).classList.add('active');
    
    // 5. Close mobile menu after selection
    const navMenu = document.getElementById('navMenu');
    const hamburger = document.getElementById('hamburger');
    if (navMenu && hamburger) {
        navMenu.classList.remove('active');
        hamburger.classList.remove('active');
    }
    
    // 6. Scroll to top on mobile when changing pages
    window.scrollTo(0, 0);
}

async function loadRandomQuote() {
    try {
        const response = await fetch('quotes.txt');
        const text = await response.text();
        const lines = text.trim().split('\n');
        const randomLine = lines[Math.floor(Math.random() * lines.length)];
        const [quote, author] = randomLine.split('|');
        
        const quoteDisplay = document.getElementById('quote-display');
        if (quoteDisplay && quote && author) {
            quoteDisplay.innerHTML = `<em>"${quote.trim()}"</em> - ${author.trim()}`;
        }
    } catch (error) {
        console.error('Error loading quote:', error);
        const quoteDisplay = document.getElementById('quote-display');
        if (quoteDisplay) {
            quoteDisplay.innerHTML = '<em>"Somewhere, something incredible is waiting to be known."</em> - Carl Sagan';
        }
    }
}

function displayEmail() {
    const emailDisplay = document.getElementById('email-display');
    if (emailDisplay) {
        const user = 'steve';
        const domain = 'sparkflorida';
        const tld = 'org';
        const email = user + '@' + domain + '.' + tld;
        emailDisplay.innerHTML = `<a href="mailto:${email}">${email}</a>`;
    }
}

document.addEventListener('DOMContentLoaded', function() {
    loadRandomQuote();
    displayEmail();
});

console.log(`
+-------------------------+-----------------+
|                         |                 |
|                         |                 |
|                         |        8        |
|                         |                 |
|            13           +---------+-------+
|                         |         |   3   |
|                         |    5    +---+---+
|                         |         | 2 |1|1|
+-------------------------+---------+---+-+-+

          Thank you for pressing F12.
`);

window.addEventListener('scroll', function() {
  const navbar = document.querySelector('#mainNav');
  if (navbar && window.scrollY > 100) {
    navbar.classList.add('navbar-shrink');
  } else if (navbar) {
    navbar.classList.remove('navbar-shrink');
  }
});

document.addEventListener('DOMContentLoaded', function() {
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.getElementById('navMenu');
    
    if (hamburger && navMenu) {
        hamburger.addEventListener('click', function() {
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
        });
    }
});
