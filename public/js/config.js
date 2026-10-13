// Edit this file to change plans, contact details and client work. No other code changes needed.
window.RES_CONFIG = {
  contactEmail: 'realeasy365@gmail.com', // TODO confirm: public contact email
  // Client work cards. Only list sites the client has approved showing.
  // To update a video: replace the file in public/video/ (same name, MP4, no audio, about 1280x720 and under 3MB)
  // and the poster image next to it (same name, .jpg). url is optional; leave it out and the card is not a link.
  work: [
    { name: "Loria Construction", trade: "Concrete & masonry", place: "Rochester, NY", url: "https://loriaconstruction.onrender.com", video: "/video/loria.mp4", poster: "/video/loria.jpg", note: "Instant-estimate quote tool, reviews and project gallery." },
    { name: "McGillivary Plumbing Services", trade: "Plumbing", place: "Gardiner, ME", url: "https://mps207.com", video: "/video/mps207.mp4", poster: "/video/mps207.jpg", note: "Lead alerts, traffic dashboard and social proof built in." },
    { name: "Barry Larry's Food Truck & Catering", trade: "Food truck & catering", place: "Portland, ME", url: "", video: "/video/barry-larrys.mp4", poster: "/video/barry-larrys.jpg", note: "Event booking form with every request sent straight to Barry." }
  ],
  plans: {
    Hosting: { setup: 350, monthly: 49 },
    Starter: { setup: 500, monthly: 75 },
    Growth: { setup: 1000, monthly: 125 },
    Pro: { setup: 1500, monthly: 199 }
  }
};
