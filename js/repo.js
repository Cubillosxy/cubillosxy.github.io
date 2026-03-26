fetch('json/repos.json')
  .then((res) => res.json())
  .then((data) => {
    let output = '';
    data.forEach(function (repo) {
      output += `
        <div class="project-card fade-in">
          <img
            class="project-card-img"
            loading="lazy"
            src="${repo.banner}"
            alt="${repo.name}"
            onerror="this.onerror=null;this.style.display='none';this.nextElementSibling.style.display='flex';"
          />
          <div class="project-card-img-fallback" style="display:none;height:180px;align-items:center;justify-content:center;background:linear-gradient(135deg,rgba(99,102,241,0.15),rgba(139,92,246,0.1));color:var(--accent-3);font-size:32px;">
            💻
          </div>
          <div class="project-card-body">
            ${repo.lang ? `<div class="project-card-lang"><span class="dot" style="background-color: ${repo.color};"></span> ${repo.lang}</div>` : ''}
            <h3 class="project-card-title"><a href="${repo.url}" target="_blank" rel="noopener">${repo.name}</a></h3>
            <p class="project-card-desc">${repo.description}</p>
            <div class="project-card-footer">
              <span>${repo.date.split('T')[0]}</span>
              <div class="project-card-stats">
                <span>⭐ ${repo.stars}</span>
                <span>🍴 ${repo.forks}</span>
              </div>
            </div>
          </div>
        </div>`;
    });
    document.getElementById('repo-card').innerHTML = output;

    // Observe new fade-in elements
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    document.querySelectorAll('#repo-card .fade-in').forEach(el => observer.observe(el));
  });
