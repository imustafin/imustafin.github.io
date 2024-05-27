require 'minitest/autorun'
require 'rdf/microdata'
require 'rdf/vocab'

module Minitest::Assertions
  def assert_triple(subject, predicate, object, msg = nil)
    q = RDF::Query.new(subject => { predicate => :object })
    q.execute(@graph)
    assert_equal(1, q.solutions.count,
      "Expected exactly one solution:\n" \
        + q.solutions.map { |x| x[:object].inspect }.join("\n"))
  end
end

class StructuredDataTest < Minitest::Test
  Schema = RDF::Vocab::SCHEMAS

  BASE = 'https://imustafin.tatar'
  ILGIZ = RDF::URI.new(BASE + '/#i')

  def str_en(s)
    RDF::Literal.new(s, language: :en)
  end

  def load_graph(s)
    fname = File.join(__dir__, '..', '_site', s)
    @page = RDF::URI.new(BASE + s)
    @graph = RDF::Graph.load(fname, base_uri: @page)
  end

  def page_uri(s)
    @page + s
  end

  def test_en_about
    load_graph('/ilgiz.html')

    assert_triple(ILGIZ, RDF.type, Schema.Person)
    assert_triple(ILGIZ, Schema.name, str_en('Ilgiz Mustafin'))
    assert_triple(ILGIZ, Schema.givenName, str_en('Ilgiz'))
    assert_triple(ILGIZ, Schema.familyName, str_en('Mustafin'))

    q = RDF::Query.new(ILGIZ => { Schema.sameAs => :link })
    q.execute(@graph)
    links = q.solutions.map { |x| x[:link] }
    assert_equal(%w[
      https://orcid.org/0009-0007-0476-5966
      https://github.com/imustafin
      https://www.linkedin.com/in/imustafin/
    ].map { |x| RDF::URI.new(x) }.to_set,
      links.to_set
    )

    assert_triple(@page, Schema.mainEntity, ILGIZ)
    assert_triple(@page, RDF.type, Schema.ProfilePage)

    assert_triple(@page, Schema.dateCreated, :x)

    assert_triple(@page, Schema.breadcrumb, :x)
  end
end
