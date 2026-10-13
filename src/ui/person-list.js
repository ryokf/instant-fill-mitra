/**
 * Komponen daftar orang (Pihak Persetujuan / Pihak Saksi) yang bisa diklik.
 */
PPAT.personList = (() => {
    function createEmptyItem(message) {
        const li = document.createElement("li");
        li.className = "empty";
        li.textContent = message;
        return li;
    }

    function createPersonItem(person, tooltip, onSelect, listEl) {
        const li = document.createElement("li");
        li.title = tooltip;
        li.textContent = person.nama;

        const nikSpan = document.createElement("span");
        nikSpan.className = "nik";
        nikSpan.textContent = "NIK: " + person.nik;
        li.appendChild(nikSpan);

        li.addEventListener("click", () => {
            listEl.querySelectorAll("li.active").forEach((el) => el.classList.remove("active"));
            li.classList.add("active");
            onSelect(person);
        });

        return li;
    }

    /**
     * Merender daftar orang ke dalam <ul>.
     * @param {HTMLElement} listEl elemen <ul>
     * @param {Array<Object>} people data orang
     * @param {Object} options
     * @param {string} options.emptyMessage teks saat daftar kosong
     * @param {string} options.tooltip tooltip tiap item
     * @param {(person: Object) => void} options.onSelect callback saat item diklik
     */
    function render(listEl, people, { emptyMessage, tooltip, onSelect }) {
        listEl.innerHTML = "";

        if (!people || people.length === 0) {
            listEl.appendChild(createEmptyItem(emptyMessage));
            return;
        }

        people.forEach((person) => {
            listEl.appendChild(createPersonItem(person, tooltip, onSelect, listEl));
        });
    }

    return { render };
})();
