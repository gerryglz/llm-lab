const form = document.querySelector('#chat-form');
const input = document.querySelector('#question');
const messages = document.querySelector('#messages');
const status = document.querySelector('#service-status');
const sendButton = form.querySelector('button[type="submit"]');
const userTemplate = document.querySelector('#user-message-template');
const assistantTemplate = document.querySelector('#assistant-message-template');
const newConversationButton = document.querySelector('#new-conversation');
const welcomeMarkup = messages.innerHTML;
const conversationHistory = [];

function scrollToLatest() {
    messages.scrollTop = messages.scrollHeight;
}

function addUserMessage(question) {
    const message = userTemplate.content.cloneNode(true);
    message.querySelector('p').textContent = question;
    messages.append(message);
    scrollToLatest();
}

function sourceRoleLabel(role) {
    return role === 'official-clarification'
        ? 'Official clarification'
        : 'Primary rule';
}

function addAssistantMessage(result) {
    const fragment = assistantTemplate.content.cloneNode(true);
    const message = fragment.querySelector('.message');
    message.querySelector('.answer-text').textContent = result.answer;

    if (result.interpretation) {
        const interpretation = message.querySelector('.interpretation');
        const kind = result.interpretation.kind.replaceAll('-', ' ');
        const strategy = result.interpretation.evidenceStrategy.replaceAll('-', ' ');
        interpretation.textContent = `Interpreted as ${kind} · ${strategy}`;
        interpretation.hidden = false;
    }

    if (result.claims?.length) {
        const claimList = message.querySelector('.claim-list');
        result.claims.forEach((claim, index) => {
            const item = document.createElement('div');
            item.className = 'claim';
            const marker = document.createElement('span');
            marker.className = 'claim-marker';
            marker.textContent = String(index + 1);
            const text = document.createElement('span');
            text.textContent = claim.text;
            const support = document.createElement('span');
            support.className = 'claim-support';
            support.textContent = `${claim.sourceIds.length} source${claim.sourceIds.length === 1 ? '' : 's'}`;
            item.append(marker, text, support);
            claimList.append(item);
        });
        claimList.hidden = false;
    }

    const strength = result.evidence?.strength ?? 'none';
    const badge = message.querySelector('.strength-badge');
    badge.textContent = `${strength} evidence`;
    badge.classList.add(strength);
    message.querySelector('.evidence-summary p').textContent =
        result.evidence?.summary ?? 'No evidence explanation was returned.';

    const citationList = message.querySelector('.citation-list');
    for (const citation of result.citations ?? []) {
        const detail = document.createElement('details');
        detail.className = 'citation';

        const summary = document.createElement('summary');
        const role = document.createElement('span');
        role.className = `role-badge ${citation.role === 'official-clarification' ? 'clarification' : ''}`;
        role.textContent = sourceRoleLabel(citation.role);

        const title = document.createElement('span');
        title.className = 'citation-title';
        title.textContent = citation.sourceTitle;

        const page = document.createElement('span');
        page.className = 'citation-page';
        page.textContent = `p. ${citation.page}`;

        const excerpt = document.createElement('blockquote');
        excerpt.textContent = citation.excerpt;

        summary.append(role, title, page);
        detail.append(summary, excerpt);
        citationList.append(detail);
    }

    messages.append(fragment);
    scrollToLatest();
}

function addPendingMessage() {
    const article = document.createElement('article');
    article.className = 'message assistant-message';
    article.id = 'pending-message';
    article.innerHTML = '<div class="message-label">Rules Assistant</div><p class="typing">Checking the official sources</p>';
    messages.append(article);
    scrollToLatest();
}

function addErrorMessage(message) {
    addAssistantMessage({
        answer: message,
        evidence: {
            strength: 'none',
            summary: 'The local service did not return a rules answer.'
        },
        citations: []
    });
    messages.lastElementChild?.classList.add('error-message');
}

async function askQuestion(question) {
    const requestHistory = conversationHistory.slice(-6);
    addUserMessage(question);
    addPendingMessage();
    sendButton.disabled = true;
    input.disabled = true;

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question, history: requestHistory })
        });
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message ?? 'The request failed.');
        }

        addAssistantMessage(result);
        conversationHistory.push(
            { role: 'user', content: question },
            { role: 'assistant', content: result.answer }
        );
        if (conversationHistory.length > 6) {
            conversationHistory.splice(0, conversationHistory.length - 6);
        }
    } catch (error) {
        addErrorMessage(error instanceof Error
            ? error.message
            : 'The assistant is unavailable.');
    } finally {
        document.querySelector('#pending-message')?.remove();
        sendButton.disabled = false;
        input.disabled = false;
        input.focus();
    }
}

form.addEventListener('submit', (event) => {
    event.preventDefault();
    const question = input.value.trim();
    if (!question) return;
    input.value = '';
    input.style.height = 'auto';
    void askQuestion(question);
});

input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 150)}px`;
});

input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        form.requestSubmit();
    }
});

function bindSuggestions() {
    document.querySelectorAll('[data-question]').forEach((button) => {
        button.addEventListener('click', () => {
            input.value = button.dataset.question;
            form.requestSubmit();
        });
    });
}

newConversationButton.addEventListener('click', () => {
    conversationHistory.length = 0;
    messages.innerHTML = welcomeMarkup;
    bindSuggestions();
    input.focus();
});

bindSuggestions();

fetch('/api/health')
    .then((response) => {
        if (!response.ok) throw new Error();
        status.classList.add('ready');
        status.querySelector('span:last-child').textContent = 'Rules index ready';
    })
    .catch(() => {
        status.classList.add('offline');
        status.querySelector('span:last-child').textContent = 'Service unavailable';
    });

